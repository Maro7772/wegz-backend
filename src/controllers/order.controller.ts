import type { Request, Response } from "express";
import mongoose from "mongoose";
import {
  getMasterPackageModel,
  getMasterPaymentMethodModel,
  getMasterOrderModel,
  getClientLookupModel,
} from "../config/tenant.js";
import { getFileUrl } from "../middlewares/upload.middleware.js";

function formatOrderResponse(req: Request, order: any) {
  const obj = typeof order.toObject === "function" ? order.toObject() : { ...order };
  return {
    ...obj,
    id: obj._id,
    receipt: getFileUrl(req, obj.receipt),
  };
}

/**
 * GET /api/admin/orders/lists
 * lists =>
 * payment_methods id, icon as link, name, description where status active
 * packages id, name, price, months, discount, final_price = price - discount where status active
 */
export const getTenantOrderLists = async (req: Request, res: Response) => {
  try {
    const [PaymentMethodModel, PackageModel] = await Promise.all([
      getMasterPaymentMethodModel(),
      getMasterPackageModel(),
    ]);

    const [paymentMethods, packages] = await Promise.all([
      PaymentMethodModel.find({ status: "active" })
        .select("_id name icon description")
        .sort({ createdAt: -1 })
        .lean(),
      PackageModel.find({ status: "active" })
        .select("_id name price months discount")
        .sort({ price: 1 })
        .lean(),
    ]);

    const formattedPaymentMethods = paymentMethods.map((pm: any) => ({
      id: pm._id,
      name: pm.name,
      icon: getFileUrl(req, pm.icon),
      description: pm.description || "",
    }));

    const formattedPackages = packages.map((pkg: any) => {
      const price = Number(pkg.price) || 0;
      const discount = Number(pkg.discount) || 0;
      return {
        id: pkg._id,
        name: pkg.name,
        price,
        months: Number(pkg.months) || 1,
        discount,
        final_price: Math.max(0, price - discount),
      };
    });

    res.json({
      success: true,
      message: "Order form lists retrieved successfully",
      data: {
        payment_methods: formattedPaymentMethods,
        packages: formattedPackages,
      },
    });
  } catch (err: any) {
    console.error("❌ Error fetching tenant order lists:", err);
    res.status(500).json({
      success: false,
      message: "Server error fetching order lists",
      error: err.message,
    });
  }
};

/**
 * POST /api/admin/orders/make-order
 * make_order => بيرفع فيه receipt as file
 * client_id بتجبها من super_admin
 * body: { package_id, payment_method_id }
 * file: receipt
 */
export const makeOrder = async (req: Request, res: Response) => {
  try {
    const tenant = req.tenant;
    if (!tenant || !tenant.clientId) {
      return res.status(401).json({
        success: false,
        message: "No tenant context found for this request. Subdomain is required.",
      });
    }

    const { package_id, payment_method_id } = req.body;

    if (!package_id || !mongoose.Types.ObjectId.isValid(package_id)) {
      return res.status(400).json({
        success: false,
        message: "Valid package_id is required",
      });
    }

    if (!payment_method_id || !mongoose.Types.ObjectId.isValid(payment_method_id)) {
      return res.status(400).json({
        success: false,
        message: "Valid payment_method_id is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Receipt file is required",
      });
    }

    const [ClientModel, PackageModel, PaymentMethodModel, OrderModel] =
      await Promise.all([
        getClientLookupModel(),
        getMasterPackageModel(),
        getMasterPaymentMethodModel(),
        getMasterOrderModel(),
      ]);

    // 1. تحقق من العميل في الـ Super Admin
    const client = await ClientModel.findById(tenant.clientId).lean();
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client record not found in Super Admin database",
      });
    }

    // 2. تحقق من الباقة
    const pkg = await PackageModel.findById(package_id).lean();
    if (!pkg || pkg.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Package not found or inactive",
      });
    }

    // 3. تحقق من طريقة الدفع
    const paymentMethod = await PaymentMethodModel.findById(payment_method_id).lean();
    if (!paymentMethod || paymentMethod.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Payment method not found or inactive",
      });
    }

    const price = Number(pkg.price) || 0;
    const discount = Number(pkg.discount) || 0;
    const final_price = Math.max(0, price - discount);

    const receiptUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    // 4. إنشاء الطلب
    const order = await OrderModel.create({
      package_id: pkg._id,
      price,
      discount,
      final_price,
      status: "pending",
      payment_method_id: paymentMethod._id,
      reject_reason: null,
      receipt: receiptUrl,
      client_id: client._id,
    });

    const populatedOrder = await OrderModel.findById(order._id)
      .populate("package_id", "name price months discount")
      .populate("payment_method_id", "name icon description")
      .lean();

    res.status(201).json({
      success: true,
      message: "Order created successfully and awaiting approval",
      data: {
        order: formatOrderResponse(req, populatedOrder || order),
      },
    });
  } catch (err: any) {
    console.error("❌ Error making order:", err);
    res.status(500).json({
      success: false,
      message: "Server error creating order",
      error: err.message,
    });
  }
};

/**
 * GET /api/admin/orders/history-orders
 * history_orders => orders of this client as pagination filter by status
 * query: status, page, limit
 */
export const historyOrders = async (req: Request, res: Response) => {
  try {
    const tenant = req.tenant;
    if (!tenant || !tenant.clientId) {
      return res.status(401).json({
        success: false,
        message: "No tenant context found for this request. Subdomain is required.",
      });
    }

    const OrderModel = await getMasterOrderModel();

    const { status, page, limit } = req.query as any;

    const filter: any = {
      client_id: new mongoose.Types.ObjectId(tenant.clientId),
    };

    if (status) {
      if (!["pending", "approve", "reject"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "status must be one of: pending, approve, reject",
        });
      }
      filter.status = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));

    const [orders, total] = await Promise.all([
      OrderModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate("package_id", "name price months discount")
        .populate("payment_method_id", "name icon description")
        .lean(),
      OrderModel.countDocuments(filter),
    ]);

    const formattedOrders = orders.map((o: any) => formatOrderResponse(req, o));

    res.json({
      success: true,
      message: "Order history retrieved successfully",
      data: {
        orders: formattedOrders,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    console.error("❌ Error fetching order history:", err);
    res.status(500).json({
      success: false,
      message: "Server error fetching order history",
      error: err.message,
    });
  }
};
