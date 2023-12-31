const AppError = require("../utils/appError");

const handleCastErrorDB=function(err){
  const message=`Invalid ${err.path}: ${err.value}`;
  return new AppError(message,400);
}

const handleDuplicateFieldsDB=function(err){
  const value = err.keyValue.name;
  const message=`Duplicate field value: "${value}" Please use another value!.`;
  return new AppError(message,404);
}

const handleValidationErrorDB=function(err){
  const errors=Object.values(err.errors).map(function(el){
    return el.message;
  })
  //const message=`Invalid input data.  ${err.message}`;
  const message=`Invalid input data. ${errors.join('. ')}`;
  return new AppError(message,400);
}

const handleJWTError=function(){
  return new AppError("Invalid token. Please log in again!",401)
}

const handleJWTExpiredError=function(){
  return new AppError("Your token has expired, please log in again!",401)
}





const sendErrorDev=function(err, res){
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack
  })
}

const sendErrorProd=function(err, res){
  if(err.isOperational){
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    })
  }
  else{
    console.error("ERROR", err);
    res.status(500).json({
      status: "error",
      message: "Something went very wrong!"
    })
  }
}

module.exports=function(err,req,res,next){
    err.statusCode=err.statusCode || 500;
    err.status=err.status || "error";
  if(process.env.NODE_ENV==="development"){
    sendErrorDev(err, res);
  }
  else{
    let error = Object.create(err);
    if (err.name === "CastError") {
      error = handleCastErrorDB(error)
    }
    if(err.code===11000){
      error = handleDuplicateFieldsDB(error)
    }
    if(error.name=="ValidationError"){
      error=handleValidationErrorDB(error)
    }
    if(error.name==="JsonWebTokenError"){
      error=handleJWTError()
    }
    if(error.name==="TokenExpiredError"){
      error = handleJWTExpiredError()
    }
    sendErrorProd(error, res)
  }
  }