const express = require('express');
const userController = require('./../controllers/userController.js');
const authController = require('./../controllers/authController.js');
const router = express.Router();


router.post(`/signUp`, authController.signup);
router.post(`/login`, authController.login);
router.post(`/forgotPassword`, authController.forgotPassword);
router.patch(`/resetPassword/:token`, authController.resetPassword);

router.use(authController.protect);
router.get('/me', userController.getMe, userController.getUser)
router.patch(`/updateMyPassword`, authController.updatePassword);
router.patch(`/updateMe`, userController.updateMe);
router.delete(`/deleteMe`, userController.deleteMe);

router.use(authController.restrictTo("admin"));

router.route('/').get(userController.getAllUsers)
router.route('/:id').get(userController.getUser).patch(userController.updateUser).delete(userController.deleteUser);


module.exports = router;