"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAbhiQuery = exports.handleAbhiHubData = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Product_1 = __importDefault(require("../models/Product"));
const FoodMenuItem_1 = require("../models/FoodMenuItem");
const Order_1 = __importDefault(require("../models/Order"));
const handleAbhiHubData = async (req, res) => {
    try {
        const userId = req.query.userId;
        const [activeOrders, realEssentials, activeSubs] = await Promise.all([
            userId && mongoose_1.default.Types.ObjectId.isValid(userId)
                ? Order_1.default.find({ customerId: userId }).sort({ createdAt: -1 }).limit(2)
                : Promise.resolve([]),
            Product_1.default.find({ status: 'Live', isStoreProduct: true }).limit(4),
            userId && mongoose_1.default.Types.ObjectId.isValid(userId)
                ? mongoose_1.default.model('LocalShopSubscription').find({ userId, status: 'active' }).limit(3).catch(() => [])
                : Promise.resolve([])
        ]);
        const formattedOrders = (activeOrders || []).map(o => ({
            _id: o._id,
            displayId: `AB-${o._id.toString().slice(-5).toUpperCase()}`,
            orderStatus: o.orderStatus,
            totalAmount: o.totalAmount,
            itemsCount: o.items?.length || 1,
            createdAt: o.createdAt
        }));
        const formattedEssentials = (realEssentials || []).map(p => ({
            _id: p._id,
            name: p.name,
            sellingPrice: p.baseSellingPrice || 0,
            mrp: p.baseMrp || 0,
            image: p.thumbnail || p.images?.[0] || '',
            brand: p.brand || 'ApexBee Essentials'
        }));
        const formattedSubs = (activeSubs || []).map((s) => ({
            _id: s._id,
            title: s.itemName || s.planName || 'Daily Subscription',
            deliverySlot: s.deliverySlot || 'Morning 6:00 AM',
            status: s.status || 'active'
        }));
        res.json({
            success: true,
            orders: formattedOrders,
            essentials: formattedEssentials,
            subscriptions: formattedSubs
        });
    }
    catch (error) {
        console.error('[handleAbhiHubData] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.handleAbhiHubData = handleAbhiHubData;
const handleAbhiQuery = async (req, res) => {
    try {
        const { query, language = 'en', userId } = req.body;
        const cleanQuery = String(query || '').trim();
        if (!cleanQuery) {
            return res.status(400).json({
                success: false,
                message: 'Query string is required.'
            });
        }
        const q = cleanQuery.toLowerCase();
        const isTelugu = language === 'te' || q.includes('kavali') || q.includes('vundi') || q.includes('enti') || q.includes('ekkada') || q.includes('chesaru') || q.includes('padi');
        let replyText = '';
        let intent = 'general';
        let products = [];
        let activeOrder = null;
        let actionLink = '';
        let actionLabel = '';
        // 1. ORDER TRACKING INTENT
        if (q.includes('order') || q.includes('track') || q.includes('delivery') || q.includes('status') || q.includes('ekkada') || q.includes('delivery time')) {
            intent = 'order_tracking';
            if (userId && mongoose_1.default.Types.ObjectId.isValid(userId)) {
                const order = await Order_1.default.findOne({ customerId: userId }).sort({ createdAt: -1 });
                if (order) {
                    activeOrder = {
                        orderId: order._id,
                        displayId: `AB-${order._id.toString().slice(-5).toUpperCase()}`,
                        orderStatus: order.orderStatus,
                        totalAmount: order.totalAmount,
                        itemsCount: order.items?.length || 1,
                        estimatedMinutes: 20,
                        placedAt: order.createdAt
                    };
                    replyText = isTelugu
                        ? `Bzzzt! 🐝 Mee order #${activeOrder.displayId} prastutam status: "${order.orderStatus}". 15-20 నిమిషాల్లో డెలివరీ అవుతుంది.`
                        : `Bzzzt! 🐝 Your order #${activeOrder.displayId} is currently "${order.orderStatus}". Estimated delivery within 15-20 minutes.`;
                    actionLink = '/my-orders';
                    actionLabel = isTelugu ? 'ఆర్డర్స్ చూడండి 🚚' : 'Track Orders Live 🚚';
                }
                else {
                    replyText = isTelugu
                        ? 'Bzzzt! 🐝 Mee account lo prastutam active orders levu. Krotthaga items order cheyali ante nannu adagandi!'
                        : 'Bzzzt! 🐝 You don\'t have any active orders right now. Would you like to explore fresh local items?';
                    actionLink = '/categories';
                    actionLabel = isTelugu ? 'కేటగిరీలు 🛒' : 'Explore Catalog 🛒';
                }
            }
            else {
                replyText = isTelugu
                    ? 'Bzzzt! 🐝 Live order tracking ki mee account meedha login avvandi.'
                    : 'Bzzzt! 🐝 Please login to track your active doorstep orders.';
                actionLink = '/my-orders';
                actionLabel = 'Login to Track 🔐';
            }
        }
        // 2. WALLET INTENT
        else if (q.includes('wallet') || q.includes('balance') || q.includes('money') || q.includes('cash') || q.includes('comm') || q.includes('coin')) {
            intent = 'wallet';
            replyText = isTelugu
                ? 'Bzzzt! 🐝 Mee ApexBee Wallet balance matram instant ga shopping & referral withdrawals kosam vadachu.'
                : 'Bzzzt! 🐝 You can manage your wallet balance, check referral commissions, and withdraw funds from the Wallet hub.';
            actionLink = '/wallet';
            actionLabel = isTelugu ? 'వాలెట్ చూడండి 💰' : 'Open Wallet Hub 💰';
        }
        // 3. HOME SERVICES INTENT
        else if (q.includes('service') || q.includes('clean') || q.includes('repair') || q.includes('fix') || q.includes('plumb') || q.includes('electric') || q.includes('ac')) {
            intent = 'service_booking';
            replyText = isTelugu
                ? 'Bzzzt! 🐝 Doorstep home services (Electrician, Plumber, AC Repair, Cleaning) 30 mins lo mee intiki vastharu!'
                : 'Bzzzt! 🐝 Book verified doorstep home services (Electrician, Plumber, Appliance Repair) instantly with doorstep warranty.';
            actionLink = '/services';
            actionLabel = isTelugu ? 'సర్వీసెస్ బుక్ చేయండి 🔧' : 'Book Doorstep Service 🔧';
        }
        // 4. DEVOTIONAL / PUJA INTENT
        else if (q.includes('puja') || q.includes('pooja') || q.includes('flower') || q.includes('vratham') || q.includes('devotional') || q.includes('temple') || q.includes('varalakshmi')) {
            intent = 'devotional';
            const fetchedProducts = await Product_1.default.find({
                $or: [
                    { name: { $regex: 'pooja|puja|flower|coconut|deepam|vratham|devotional', $options: 'i' } },
                    { categoryName: { $regex: 'devotional|pooja', $options: 'i' } }
                ]
            }).limit(4);
            products = fetchedProducts.map(p => ({
                _id: p._id,
                name: p.name,
                sellingPrice: p.baseSellingPrice || p.price || 0,
                mrp: p.baseMrp || p.price || 0,
                image: p.thumbnail || p.images?.[0] || '',
                vendorName: p.brand || 'ApexBee Devotional'
            }));
            replyText = isTelugu
                ? 'Bzzzt! 🪔 Complete Varalakshmi & Festival Pooja kits, fresh flowers, and coconut doorstep 30-min delivery available!'
                : 'Bzzzt! 🪔 Ensure complete festival puja preparation. Instantly order flowers, fruits, and pooja samagri kits with 30-min doorstep delivery.';
            actionLink = '/category/Devotional';
            actionLabel = isTelugu ? 'పూజా సామాగ్రి చూడండి 🪔' : 'Order Puja Special 🪔';
        }
        // 5. PRODUCT / GROCERY SEARCH INTENT
        else {
            intent = 'product_search';
            const cleanKeywords = q.replace(/kavali|kavali|cheyandi|order|buy|search|looking|for|need|show|me/g, '').trim();
            const regexPattern = cleanKeywords ? cleanKeywords.split(' ').filter(w => w.length > 2).join('|') : q;
            const [prods, foodItems] = await Promise.all([
                Product_1.default.find({
                    $or: [
                        { name: { $regex: regexPattern || q, $options: 'i' } },
                        { description: { $regex: regexPattern || q, $options: 'i' } },
                        { categoryName: { $regex: regexPattern || q, $options: 'i' } }
                    ]
                }).limit(4),
                FoodMenuItem_1.FoodMenuItem.find({
                    name: { $regex: regexPattern || q, $options: 'i' }
                }).limit(4)
            ]);
            const formattedProds = (prods || []).map(p => ({
                _id: p._id,
                name: p.name,
                sellingPrice: p.baseSellingPrice || p.price || 0,
                mrp: p.baseMrp || p.price || 0,
                image: p.thumbnail || p.images?.[0] || '',
                vendorName: p.brand || 'Local Vendor'
            }));
            const formattedFood = (foodItems || []).map(f => ({
                _id: f._id,
                name: f.name,
                sellingPrice: f.offerPrice || f.basePrice || 0,
                mrp: f.basePrice || 0,
                image: f.image || '',
                vendorName: 'Gourmet Food Outlet'
            }));
            products = [...formattedProds, ...formattedFood].slice(0, 4);
            if (products.length > 0) {
                replyText = isTelugu
                    ? `Bzzzt! 🐝 Mee kosam "${cleanQuery}" nunchi Top Items dhorikayi! Direct Basket loki add cheskovachu.`
                    : `Bzzzt! 🐝 Here are the top matched items for "${cleanQuery}". Tap + Add to instantly place into your basket!`;
            }
            else {
                replyText = isTelugu
                    ? `Bzzzt! 🐝 Mee query "${cleanQuery}" ki specific item dhorakapoyina, mana Local Stores & Groceries lo 1000+ items unnay.`
                    : `Bzzzt! 🐝 I couldn't find exact matches for "${cleanQuery}", but you can explore 1000+ local fresh groceries and dishes in our store catalog.`;
                actionLink = '/categories';
                actionLabel = isTelugu ? 'షాపింగ్ మొదలుపెట్టండి 🛍️' : 'Explore All Categories 🛍️';
            }
        }
        return res.status(200).json({
            success: true,
            query: cleanQuery,
            replyText,
            intent,
            products,
            activeOrder,
            actionLink,
            actionLabel
        });
    }
    catch (error) {
        console.error('[handleAbhiQuery] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Abhi AI Assistant service error.',
            error: error.message
        });
    }
};
exports.handleAbhiQuery = handleAbhiQuery;
