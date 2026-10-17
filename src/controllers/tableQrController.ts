import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { FoodPartnerAuthRequest } from '../middleware/foodPartnerAuthMiddleware';
import { TableQR } from '../models/TableQR';
import { FoodMenuItem } from '../models/FoodMenuItem';
import { RestaurantProfile } from '../models/RestaurantProfile';
import { Order } from '../models/Order';

/**
 * --- RESTAURANT PARTNER / POS ENDPOINTS ---
 */

// GET ALL TABLES & SEPARATE QRS FOR RESTAURANT
export const getTablesWithQRs = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    if (!restaurantId) {
      res.status(401).json({ success: false, message: 'Unauthorized restaurant context' });
      return;
    }

    const tables = await TableQR.find({ restaurantId })
      .populate('selectedItemIds', 'name basePrice offerPrice foodType categoryId image isBestseller')
      .sort({ tableNumber: 1 });

    res.status(200).json({ success: true, tables });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch table QRs', error: error.message });
  }
};

// CREATE NEW TABLE AND AUTO-GENERATE SEPARATE QR
export const createTableWithQR = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    if (!restaurantId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const {
      tableNumber,
      section,
      capacity,
      label,
      menuMode = 'ALL_ITEMS',
      selectedItemIds,
      discountPercent = 0,
      specialNote,
    } = req.body;

    if (!tableNumber) {
      res.status(400).json({ success: false, message: 'Table number is required' });
      return;
    }

    const cleanTable = String(tableNumber).trim().toUpperCase();

    // Check duplicate table
    const existing = await TableQR.findOne({ restaurantId, tableNumber: cleanTable });
    if (existing) {
      res.status(400).json({ success: false, message: `Table ${cleanTable} already exists` });
      return;
    }

    // Determine menu items from added dishes if none provided
    let itemsToAssign = selectedItemIds;
    if (!itemsToAssign || itemsToAssign.length === 0) {
      const activeMenuItems = await FoodMenuItem.find({ restaurantId, status: 'ACTIVE' }).select('_id');
      itemsToAssign = activeMenuItems.map((i) => i._id);
    }

    const qrToken = `qr-${cleanTable.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;

    const newTableQR = new TableQR({
      restaurantId,
      tableNumber: cleanTable,
      section: section || 'Main Dining Hall',
      capacity: Number(capacity) || 4,
      label: label || `Table ${cleanTable} QR Standee`,
      qrToken,
      menuMode,
      selectedItemIds: itemsToAssign,
      discountPercent: Number(discountPercent) || 0,
      specialNote: specialNote || `Welcome to Table ${cleanTable}! Scan to view menu & order directly.`,
      status: 'AVAILABLE',
      isActive: true,
      scanCount: 0,
    });

    await newTableQR.save();
    const populated = await TableQR.findById(newTableQR._id).populate('selectedItemIds', 'name basePrice foodType');

    res.status(201).json({ success: true, message: `Table ${cleanTable} and separate QR generated`, table: populated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create table QR', error: error.message });
  }
};

// UPDATE TABLE DETAILS & ASSIGNED MENU ITEMS
export const updateTableQR = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    const { id } = req.params;
    const updateData = req.body;

    const table = await TableQR.findOneAndUpdate({ _id: id, restaurantId }, updateData, { new: true })
      .populate('selectedItemIds', 'name basePrice foodType categoryId');

    if (!table) {
      res.status(404).json({ success: false, message: 'Table QR not found' });
      return;
    }

    res.status(200).json({ success: true, message: 'Table QR updated successfully', table });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update table QR', error: error.message });
  }
};

// DELETE TABLE & QR
export const deleteTableQR = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    const { id } = req.params;

    const table = await TableQR.findOneAndDelete({ _id: id, restaurantId });
    if (!table) {
      res.status(404).json({ success: false, message: 'Table QR not found' });
      return;
    }

    res.status(200).json({ success: true, message: `Table ${table.tableNumber} deleted successfully` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete table QR', error: error.message });
  }
};

// BULK AUTO-GENERATE SEPARATE QRS FOR ALL TABLES
export const generateAllSeparateTableQRs = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    const restaurantId = req.foodPartnerContext?.restaurantId;
    if (!restaurantId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { tablesList, menuMode, selectedItemIds, discountPercent } = req.body;

    const activeMenuItems = await FoodMenuItem.find({ restaurantId, status: 'ACTIVE' }).select('_id');
    const allItemIds = activeMenuItems.map((i) => i._id);
    const assignedItems = (selectedItemIds && selectedItemIds.length > 0) ? selectedItemIds : allItemIds;

    const targets = Array.isArray(tablesList) && tablesList.length > 0
      ? tablesList
      : ['T-01', 'T-02', 'T-03', 'T-04', 'T-05', 'T-06', 'T-07', 'T-08'];

    const results = [];
    for (const tNum of targets) {
      const cleanTable = String(tNum).trim().toUpperCase();
      const qrToken = `qr-${cleanTable.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;

      const upserted = await TableQR.findOneAndUpdate(
        { restaurantId, tableNumber: cleanTable },
        {
          restaurantId,
          tableNumber: cleanTable,
          section: 'Main Dining Hall',
          capacity: 4,
          label: `Table ${cleanTable} QR Standee`,
          qrToken,
          menuMode: menuMode || 'ALL_ITEMS',
          selectedItemIds: assignedItems,
          discountPercent: discountPercent || 0,
          status: 'AVAILABLE',
          isActive: true,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      results.push(upserted);
    }

    res.status(200).json({ success: true, message: `Generated separate QRs for ${results.length} tables`, tables: results });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Bulk generation failed', error: error.message });
  }
};

/**
 * --- PUBLIC CUSTOMER-FACING SCAN ENDPOINTS ---
 */

// GET SCANNED MENU (WHEN GUEST SCANS QR CODE WITH PHONE)
export const getCustomerScannedMenu = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tokenOrTable } = req.params;
    const query = String(tokenOrTable).trim();

    // Find table by qrToken or tableNumber
    let table = await TableQR.findOne({
      $or: [
        { qrToken: query },
        { tableNumber: query.toUpperCase() },
        { _id: mongoose.isValidObjectId(query) ? query : null },
      ],
      isActive: true,
    }).populate('restaurantId', 'restaurantName logo coverImage locality cuisines phone operationalStatus diningEnabled');

    if (!table) {
      // Fallback: Return first active restaurant profile and its active menu
      const firstRest = await RestaurantProfile.findOne({ operationalStatus: 'OPEN' });
      if (firstRest) {
        const items = await FoodMenuItem.find({ restaurantId: firstRest._id, status: 'ACTIVE' }).populate('categoryId', 'name');
        res.status(200).json({
          success: true,
          table: {
            tableNumber: query.toUpperCase() || 'T-01',
            section: 'Main Dining Hall',
            discountPercent: 10,
            specialNote: 'Welcome! Scan and order directly without waiting for a waiter.',
          },
          restaurant: firstRest,
          items,
        });
        return;
      }

      res.status(404).json({ success: false, message: 'Invalid or inactive QR code' });
      return;
    }

    // Increment scan count asynchronously
    TableQR.updateOne({ _id: table._id }, { $inc: { scanCount: 1 }, $set: { lastScannedAt: new Date() } }).exec();

    // Fetch actual dishes:
    // If CUSTOM_SELECTION and selectedItemIds are set, return those items.
    // If ALL_ITEMS, return all active FoodMenuItems from the restaurant.
    let items;
    if (table.menuMode === 'CUSTOM_SELECTION' && table.selectedItemIds && table.selectedItemIds.length > 0) {
      items = await FoodMenuItem.find({
        _id: { $in: table.selectedItemIds },
        restaurantId: table.restaurantId,
        status: 'ACTIVE',
      }).populate('categoryId', 'name').sort({ sortOrder: 1, name: 1 });
    } else {
      items = await FoodMenuItem.find({
        restaurantId: table.restaurantId,
        status: 'ACTIVE',
      }).populate('categoryId', 'name').sort({ sortOrder: 1, name: 1 });
    }

    res.status(200).json({
      success: true,
      table: {
        _id: table._id,
        tableNumber: table.tableNumber,
        section: table.section,
        label: table.label,
        qrToken: table.qrToken,
        menuMode: table.menuMode,
        discountPercent: table.discountPercent,
        specialNote: table.specialNote,
      },
      restaurant: table.restaurantId,
      items,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load scanned menu', error: error.message });
  }
};

// PLACE DINE-IN ORDER FROM SCANNED QR
export const placeCustomerTableOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { qrToken, tableNumber, items, customerName, customerPhone, orderNotes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: 'Cart items cannot be empty' });
      return;
    }

    const table = await TableQR.findOne({
      $or: [{ qrToken }, { tableNumber: String(tableNumber).toUpperCase() }],
    });

    const orderNumber = `TB-${Math.floor(1000 + Math.random() * 9000)}`;

    let subtotal = 0;
    const formattedItems = [];
    for (const entry of items) {
      const dish = await FoodMenuItem.findById(entry.itemId);
      const price = dish ? (dish.offerPrice && dish.offerPrice > 0 ? dish.offerPrice : dish.basePrice) : entry.price;
      const qty = entry.quantity || 1;
      subtotal += price * qty;
      formattedItems.push({
        menuItemId: dish?._id,
        name: dish?.name || entry.name,
        price,
        quantity: qty,
        notes: entry.notes || orderNotes || '',
      });
    }

    const discountAmount = table ? Math.round((subtotal * (table.discountPercent || 0)) / 100) : 0;
    const gstAmount = Math.round((subtotal - discountAmount) * 0.05);
    const grandTotal = Math.max(0, subtotal - discountAmount + gstAmount);

    // Update table status to OCCUPIED and record active order
    if (table) {
      table.status = 'OCCUPIED';
      table.activeOrder = {
        orderNumber: `#${orderNumber}`,
        itemsCount: formattedItems.length,
        amount: grandTotal,
        seatedAt: 'Just now',
        waiter: 'QR Mobile Order',
      };
      await table.save();
    }

    // Persist real Order document for Kitchen Live Orders & notification chimes
    let orderDoc: any = null;
    if (table?.restaurantId) {
      try {
        const restaurantProfile = await RestaurantProfile.findById(table.restaurantId);
        const sellerId = restaurantProfile?.userId || table.restaurantId;

        orderDoc = await Order.create({
          orderNumber: `ORD-${orderNumber}`,
          sellerId,
          customerName: customerName || 'Dine-In Guest',
          customerPhone: customerPhone || '',
          customerNotes: `Table ${table?.tableNumber || tableNumber}${orderNotes ? ' - ' + orderNotes : ''}`,
          orderType: 'DINE_IN',
          tableNumber: table?.tableNumber || tableNumber || '',
          orderStatus: 'placed',
          paymentStatus: 'Pending',
          totalAmount: grandTotal,
          items: formattedItems.map((fi) => ({
            productId: fi.menuItemId ? new mongoose.Types.ObjectId(fi.menuItemId) : new mongoose.Types.ObjectId(),
            productName: fi.name,
            sku: `DISH-${(fi.name || 'ITEM').replace(/\s+/g, '-').toUpperCase()}`,
            quantity: fi.quantity,
            price: fi.price,
          })),
          timeline: [
            {
              status: 'placed',
              title: 'Table QR Order Placed',
              description: `Dine-in order placed from Table ${table?.tableNumber || tableNumber}`,
              timestamp: new Date(),
            },
          ],
        });
      } catch (err: any) {
        console.warn('Could not persist Order doc for table order:', err?.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Order punched to kitchen successfully',
      order: {
        orderNumber: `#${orderNumber}`,
        tableNumber: table?.tableNumber || tableNumber,
        itemsCount: formattedItems.length,
        subtotal,
        discount: discountAmount,
        gst: gstAmount,
        grandTotal,
        status: 'PLACED',
        estimatedPrepTime: '15 - 20 mins',
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to place table order', error: error.message });
  }
};
