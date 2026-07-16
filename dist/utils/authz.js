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
const requireSelfOrAdmin = (req, userId) => {
    const authUser = req.user;
    if (!authUser)
        return false;
    return authUser.id.toString() === userId.toString() || authUser.roles.includes('admin');
};
exports.requireSelfOrAdmin = requireSelfOrAdmin;
