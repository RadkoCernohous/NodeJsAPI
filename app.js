const path = require("path")
const fs = require('fs');
const express = require('express');
const morgan = require('morgan');
const rateLimit=require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

const AppError=require('./utils/appError');
const globalErrorHandler=require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const viewRouter = require('./routes/viewRoutes');

const app = express();
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"))

app.use(helmet())

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

const limiter=rateLimit({
  max:100,
  windowMs: 60*60*1000,
  message:"Too many request from this IP, please try again in an hour"
})


/*funcWrapper=function(funkce){
  return function(a,b){
    funkce(a,b)
  }
}

scitani=funcWrapper(function(cislo1, cislo2){
  console.log(`Výsledek: ${cislo1+cislo2}`);
})

scitani(1,2)*/

app.use("/api",limiter)

app.use(express.json({
  limit:'10kb'
}));

app.use(mongoSanitize());

app.use(xss());

app.use(hpp({
  whitelist:["duration","ratingsQuantity", "ratingsAverage", "maxGroupSize","difficulty","price"]
}));

app.use(express.static(path.join(__dirname, "public")));

app.use(function (req, res, next) {
  req.requestTime = new Date().toISOString();
  next();
});

app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);

app.all("*", function(req,res, next){
  next(new AppError(`Can´t find ${req.originalUrl} on this server!`,404))
})

app.use(globalErrorHandler);

module.exports = app;