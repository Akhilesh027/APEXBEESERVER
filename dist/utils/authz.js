"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSelfOrAdmin = exports.sameObjectId = exports.isCustomer = exports.isSeller = exports.isAdmin = void 0;
const isAdmin = (user) => {
    return !!user?.roles.includes('admin');
};
exports.isAdmin = isAdmin;
const isSeller = (user) => {
    return !!user?.roles.some(role => ['vendor', 'wholesaler', 'manufacturer'].includes(role));
};
exports.isSeller = isSeller;
const isCustomer = (user) => {
    return !!user?.roles.includes('customer');
};
exports.isCustomer = isCustomer;
const sameObjectId = (a, b) => {
    if (!a || !b)
        return false;
    return a.toString() === b.toString();
};
exports.sameObjectId = sameObjectId;
const requireSelfOrAdmin = (req, targetId) => {
    const authUser = req.user;
    if (!authUser)
        return false;
    if (authUser.roles?.includes('admin'))
        return true;
    if (authUser.id && targetId && authUser.id.toString() === targetId.toString())
        return true;
    if (authUser.roles?.some((r) => ['vendor', 'wholesaler', 'manufacturer', 'seller', 'delivery_partner'].includes(r)))
        return true;
    return false;
};
exports.requireSelfOrAdmin = requireSelfOrAdmin;
