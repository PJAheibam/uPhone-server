db.users.aggregate([
  {
    $match: {
      email: { $in: [/carlos.aquino/i] },
      active: { $in: [true, null] },
      deleted: { $in: [false, null] },
    },
  },
  { $sort: { created_at: -1 } },
  {
    $unwind: "$profile",
  },
  {
    $unwind: "$profile.products",
  },
  {
    $unwind: "$profile.products.profile",
  },
  {
    $lookup: {
      from: "products",
      localField: "profile.products.product",
      foreignField: "_id",
      as: "products",
    },
  },
  {
    $unwind: "$products",
  },
  {
    $addFields: {
      internal: {
        $filter: {
          input: "$products.internals",
          as: "i",
          cond: {
            $eq: ["$$i._id", "$profile.products.profile"],
          },
        },
      },
    },
  },
  {
    $project: {
      _id: 1,
      name: 1,
      "profile.products": 1,
      products: {
        name: 1,
        _id: 1,
      },
      internal: { _id: 1, name: 1 },
    },
  },
]);
