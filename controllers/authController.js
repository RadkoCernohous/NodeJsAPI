const {promisify} = require("util");
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync=require('./../utils/catchAsynch');
const AppError=require('./../utils/appError');
const sendEmail=require('./../utils/email');
const { decode } = require("punycode");
const { application } = require("express");
const crypto=require('crypto')


const signToken=function(id){
    return jwt.sign({id},process.env.JWT_SECRET,{
        expiresIn: process.env.JWT_EXPIRES_IN
    })
}

const createSendToken=function(user,statusCode, res){
    const token = signToken(user._id);

    const cookieOptions={
        expires: new Date(Date.now()+process.env.JWT_COOKIE_EXPIRES_IN*24*60*60*1000),
        secure:true,
        httpOnly:true
    }

    if(process.env.NODE_ENV=="development"){
        cookieOptions.secure=false;
    }
    res.cookie("jwt", token, cookieOptions);

    user.password=undefined;
    res.status(statusCode).json({
        status: "success",
        token,
        data:{user}
    })
}

exports.signup = catchAsync(async function(req, res, next){
    const newUser = await User.create({
        name: req.body.name, 
        email: req.body.email,
        password: req.body.password,
        passwordConfirm: req.body.passwordConfirm,
        passwordChangedAt: req.body.passwordChangedAt,
        role: req.body.role,
    });
    createSendToken(newUser,201,res);
})

exports.login= catchAsync(async function(req,res,next){
    const {email, password} = req.body;

    if(!email || !password){
        return next(new AppError("Please provide e-mail and password"),400);
    }

    const user = await User.findOne({email}).select("+password");
    const correct = await user?.correctPassword(password);

    if(!user || !correct){
        return next(new AppError("Incorrect e-mail or password", 401))
    }
    createSendToken(user,200,res);
})

exports.protect= catchAsync(async function(req,res,next){
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")){
        token = req.headers.authorization.split(" ")[1];
    }
    if(!token){
        return next(new AppError("You are not logged in, please log in to get access",401))
    }

    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    //console.log(decoded);
    
    const currentUser = await User.findById(decoded.id);
    if(!currentUser){
        return next(new AppError("The user belonging to this token does no longer exist", 401))
    }

    if(currentUser.changedPasswordAfter(decoded.iat)){
        return next(new AppError("User recently changed password, please log in again.",401))
    };

    req.user=currentUser;
    next()
}
)

exports.restrictTo= function(...roles){
    return function(req, res, next){
        if(!roles.includes(req.user.role)){
            return next(new AppError("You do not have a permission to perform this action", 403))
        }
        next()
    }

}

exports.forgotPassword=catchAsync(async function(req,res,next){
    const user = await User.findOne({email: req.body.email})
    if(!user){
       return next(new AppError("There is no user with that e-mail address", 404))
    }

    const resetToken=user.createPasswordResetToken();
    await user.save({validateBeforeSave:false});
    
    const resetURL=`${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;

    const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to ${resetURL}`;
    try{
        await sendEmail({
            email: user.email,
            subject: "Your password reset token",
            message
        })
    
        res.status(200).json({
            status:"success",
            message:"Token sent to e-mail"
        })
    }
    catch(err){
        user.passwordResetToken=undefined;
        user.passworResetExpires=undefined;
        await user.save({validateBeforeSave:false});

        return next(new AppError("There was an error sending the e-mail. Try again later.",500))
    }
})

exports.resetPassword=catchAsync(async function(req,res,next){
    const hashedToken=crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user =await  User.findOne({passwordResetToken: hashedToken, passwordResetExpires:{$gt: Date.now()}})

    if(!user){
        return next(new AppError("Token is invalid or has expired",400))
    }

    user.password=req.body.password;
    user.passwordConfirm=req.body.passwordConfirm;
    user.passwordResetToken=undefined;
    user.passwordResetExpires=undefined;
    await user.save();

    createSendToken(user,200,res);

})

exports.updatePassword=catchAsync(async function(req,res,next){
    console.log(req);
    const user = await User.findById(req.user.id).select("+password")
    const correct = await user?.correctPassword(req.body.passwordCurrent);

    if(!correct){
        return next(new AppError("Incorrect password", 401))
    }


    user.password=req.body.password;
    user.passwordConfirm=req.body.passwordConfirm

    await user.save()

    createSendToken(user,200,res);
})