const Tour = require("./../models/tourModel");
const catchAsync=require('./../utils/catchAsynch');
const AppError=require('./../utils/appError');
const factory = require("./handlerFactory")

//const tours = JSON.parse(fs.readFileSync(`${__dirname}/../dev-data/data/tours-simple.json`));

exports.test=catchAsync(async function(req,res,next){
  const tour = await Tour.findById("5c88fa8cf4afda39709c2955");
  tour.locations.push({        "description": "Test",
  type: "Point",
  coordinates: [-80.128473, 25.781842],
  day: 1})
  await Tour.create(tour)
  res.status(200).json({
    status: 'success',
    requestedAt: req.requestTime,
    data: {
      tour
    }
  })
})


exports.aliasTopTours = function (req, res, next) {
  req.query.limit = "5";
  req.query.sort = "-ratingsAverage,price";
  req.query.fields = "name, price, ratingsAverage, summary, difficulty";
  next()
}

exports.getAllTours = factory.getAll(Tour)
exports.getOneTour = factory.getOne(Tour, {path:'reviews'})
exports.createTour = factory.createOne(Tour)
exports.UpdateTour = factory.updateOne(Tour)
exports.deleteTour=factory.deleteOne(Tour)

exports.getTourStats = catchAsync (async function (req, res, next) {
  let stats = await Tour.aggregate([
    { $match: { ratingsAverage: { $gte: 4.5 } } },
    {
      $group: {
        _id: { $toUpper: "$difficulty" },
        num: { $sum: 1 },
        numRatings: { $sum: "$ratingsQuantity" },
        avgRating: { $avg: "$ratingsAverage" },
        avgPrice: { $avg: "$price" },
        minPrice: { $min: "$price" },
        maxPrice: { $max: "$price" },
      }
    },
    {
      $sort: {
        avgPrice: 1
      }
    }/*,
    {
      $match: {
        _id: { $ne: 'EASY' }
      }
    }*/

  ])
  res.status(200).json({
    status: "success",
    data: {
      stats
    }
  })
})

exports.getMonthlyPlan = catchAsync(async function (req, res, next) {
    const year = req.params.year;
    const plan = await Tour.aggregate([
      { $unwind: "$startDates" },
      {
        $match: {
          startDates: {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31`)
          }
        }
      }, {
        $group: {
          _id: { $month: "$startDates" },
          numTourStarts: { $sum: 1 },
          tours: { $push: '$name' }
        }
      },
      {
        $addFields: { month: "$_id" }
      },
      {
        $project: {
          _id: 0
        }
      },
      {
        $sort: {
          numTourStarts: -1
        }
      },
      {
        $limit: 12
      }
    ]);
    res.status(200).json({
      status: "success",
      data: {
        plan
      }
    })
})


exports.getToursWithin=catchAsync(async function(req,res,next){
  const {distance, latlng, unit}=req.params;
  const [lat, lng]=latlng.split(",");
  const radius=unit==="mi"?distance/3963.2:distance/6378.1

  if(!lat || !lng){
    next(new AppError("Please provide latitude and longitude in the format lat,lng",400))
  }

  const tours = await Tour.find({
    startLocation:{$geoWithin: {$centerSphere:[[lng,lat],radius]}}
  })

  res.status(200).json({
    status: "success",
    results: tours.length,
    data:{
      data: tours
    }
  })
})

exports.getDistances=catchAsync(async function(req,res,next){
  const {latlng, unit}=req.params;
  const [lat, lng]=latlng.split(",");
  const multiplier=unit==="mi"?0.000621371:0.001


  if(!lat || !lng){
    next(new AppError("Please provide latitude and longitude in the format lat,lng",400))
  }

  const distances=await Tour.aggregate([
    {$geoNear:{
      near:{
        type:"Point",
        coordinates: [lng*1,lat*1]
      },
      distanceField:"distance",
      distanceMultiplier:multiplier
    }},
    {
      $project:{
        distance:1,
        name:1
      }
    }
  ])

  res.status(200).json({
    status: "success",
    results: distances.length,
    data:{
      data: distances
    }
  })
})