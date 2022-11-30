require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// const { application } = require("express");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_USER_PASSWORD}@cluster0.0hl8m1y.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    const brandCollection = client.db("uPhone").collection("brands");
    const userCollection = client.db("uPhone").collection("users");
    const productCollection = client.db("uPhone").collection("products");
    const bookingCollection = client.db("uPhone").collection("bookings");
    const reportCollection = client.db("uPhone").collection("reports");

    const deletedUserCollection = client
      .db("uPhone")
      .collection("deletedUsers");

    /****************** BRANDS START ******************/

    app.get("/brands", async (req, res) => {
      try {
        const brands = await brandCollection.find({}).toArray();

        return res.send(brands);
      } catch (err) {
        console.log(err);
        return req.sendStatus(500);
      }
    });

    /******************* BRANDS END *******************/

    /************* USERS START *************/
    //this will get public user info
    app.get("/users/:id", async (req, res) => {
      try {
        const uid = req.params.id;
        const user = await userCollection.find({ uid }).toArray();

        if (user.length === 0) return res.sendStatus(404);
        // console.log(user);
        const data = {
          fullName: user[0].fullName,
          email: user[0].email,
          photoURL: user[0].profilePhoto.thumb_url,
          verified: user[0].verified,
        };
        // console.log(data);
        return res.send(data);
      } catch (error) {
        console.log(error);
        res.sendStatus(500);
      }
    });

    app.get("/users", verifyJWT, async (req, res) => {
      try {
        const userId = req.query.uid;
        const role = req.query.role;
        if (userId !== req.decoded.uid) return res.sendStatus(403);

        const user = await userCollection.find({ uid: userId }).toArray();

        if (user.length === 0 || user[0].role !== "admin")
          return res.sendStatus(401);

        const users = await userCollection
          .find({ uid: { $ne: userId }, role })
          .toArray();

        res.send(users);
      } catch (err) {
        return res.sendStatus(500);
      }
    });

    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        const query = { uid: user.uid };

        const hasRecord = await userCollection.find(query).toArray();

        if (user.role === "admin") return res.sendStatus(406);

        if (hasRecord.length > 0) return res.sendStatus(200);
        // console.log("hasRecord", hasRecord);
        const document = {
          uid: user.uid,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          profilePhoto: user.profilePhoto,
        };

        await userCollection.insertOne(document);

        return res.sendStatus(201);
      } catch (err) {
        return res.sendStatus(500);
      }
    });

    app.patch("/users/:id", verifyJWT, async (req, res) => {
      try {
        const targetId = req.params.id;
        const uid = req.query.uid;
        const payload = req.body;
        if (uid !== req.decoded.uid) return res.sendStatus(403);

        const result = await userCollection.updateOne(
          { uid: targetId },
          {
            $set: { ...payload },
          }
        );
        // console.log(result);
        return res.send(result);
      } catch (error) {
        return res.sendStatus(500);
      }
    });

    app.get("/user-role", verifyJWT, async (req, res) => {
      try {
        const uid = req.query.uid;

        // console.log(uid, req.decoded);

        if (uid !== req.decoded.uid) return res.sendStatus(403);

        const user = await userCollection.find({ uid }).toArray();

        return res.send({ role: user[0].role });
      } catch (error) {
        return res.sendStatus(500);
      }
    });

    app.delete("/users/:id", verifyJWT, async (req, res) => {
      try {
        const uid = req.params.id;
        const adminId = req.query.uid;

        // console.log(uid, adminId);

        if (adminId !== req.decoded.uid) return req.sendStatus(403);

        const targetUser = await userCollection.find({ uid }).toArray();

        if (targetUser.length === 0) return res.sendStatus(404);

        const doc = targetUser[0];

        delete doc._id;

        const deleteUserDbRes = await deletedUserCollection.insertOne(doc);

        const deleteResponse = await userCollection.deleteOne({ uid });

        return res.send(deleteResponse);
      } catch (error) {
        return res.sendStatus(500);
      }
    });
    /************* USERS END *************/

    /************* PRODUCTS START *************/
    app.get("/products", async (req, res) => {
      try {
        const brandId = req.query.brandId;
        const userId = req.query.uid;
        let products = [];
        if (brandId === "all") {
          const query = {
            // status: "available",
            // sellerId: { $ne: userId },
          };
          products = await productCollection.find(query).toArray();
          return res.send(products);
        }

        products = await productCollection.find({ brandId }).toArray();
        return res.send(products);
      } catch (error) {
        console.error(error);
        return res.sendStatus(500);
      }
    });

    app.get("/ad-products", async (req, res) => {
      try {
        const products = await productCollection
          .find({
            advertise: true,
          })
          .toArray();
        return res.send(products);
      } catch (error) {
        return res.sendStatus(500);
      }
    });

    app.get("/my-products", verifyJWT, async (req, res) => {
      try {
        const uid = req.query.uid;
        // console.log(uid, req.decoded);
        if (uid !== req.decoded.uid) return res.sendStatus(403);

        const products = await productCollection
          .find({ sellerId: uid })
          .toArray();

        return res.send(products);
      } catch (err) {
        return res.sendStatus(500); // Internal server error;
      }
    });

    app.post("/products", verifyJWT, async (req, res) => {
      const data = req.body;
      if (!data.uid) return res.send(401);

      try {
        const user = await userCollection.find({ uid: data.uid }).toArray();
        if (user[0].role === "admin" || user[0].role === "seller") {
          const doc = {
            name: data.name,
            images: data.images,
            moreDetails: data.moreDetails,
            sellingPrice: data.sellingPrice,
            originalPrice: data.originalPrice,
            location: data.location,
            brand: data.brand,
            brandId: data.brandId,
            sellerId: data.uid,
            status: "available",
            advertise: false,
            postedOn: data.postedOn,
            // sellerImg: data.sellerImg,
            condition: data.condition,
            purchaseYear: data.purchaseYear,
          };
          const response = await productCollection.insertOne(doc);
          // console.log("Line-71", response);
          return res.send(response);
        }
        //if user is neither seller nor admin
        return res.sendStatus(403);
      } catch (error) {
        console.error(error);
        return res.sendStatus(400);
      }
    });

    app.patch("/products/:id", verifyJWT, async (req, res) => {
      try {
        const id = req.params.id;
        const payload = req.body;
        const product = await productCollection
          .find({ _id: ObjectId(id) })
          .toArray();

        if (product.length === 0) return res.sendStatus(400);

        const result = await productCollection.updateOne(
          { _id: ObjectId(id) },
          {
            $set: { ...payload },
          }
        );
        return res.send(result);
      } catch (error) {
        return res.sendStatus(500);
      }
    });

    app.delete("/products", verifyJWT, async (req, res) => {
      try {
        const id = req.query.id;
        const uid = req.query.uid;
        // console.log(id, uid);
        if (uid !== req.decoded.uid) return res.sendStatus(403);

        const product = await productCollection
          .find({ _id: ObjectId(id) })
          .toArray();

        if (product.length === 0) return res.sendStatus(404);

        if (product[0].sellerId !== uid) return res.sendStatus(403);

        const result = await productCollection.deleteOne({ _id: ObjectId(id) });

        return res.send(result);
      } catch (error) {
        return res.sendStatus(500);
      }
    });
    /************** PRODUCTS END **************/

    /************ Bookings START ************/
    app.post("/bookings", verifyJWT, async (req, res) => {
      try {
        const payload = req.body;

        // console.log("line 289: ", payload);

        if (payload.buyerId !== req.decoded.uid) return res.sendStatus(403);

        const product = await productCollection
          .find({ _id: ObjectId(payload.productId) })
          .toArray();

        if (product.length === 0) return res.sendStatus(400);

        const changeStatus = await productCollection.updateOne(
          { _id: ObjectId(payload.productId) },
          {
            $set: {
              status: "booked",
            },
          }
        );

        // console.log("line-306: ", changeStatus);

        const result = await bookingCollection.insertOne({
          productId: ObjectId(payload.productId),
          sellerId: payload.sellerId,
          buyerId: payload.buyerId,
          buyerPhoneNumber: payload.buyerPhoneNumber,
          meetUpLocation: payload.meetUpLocation,
          paymentStatus: false,
        });

        return res.sendStatus(202);
      } catch (error) {
        return res.sendStatus(500);
      }
    });

    app.get("/bookings", async (req, res) => {
      try {
        const uid = req.query.uid;

        // const bookings = await bookingCollection
        //   .find({ buyerId: uid })
        //   .toArray();
        // const products =
        const result = await bookingCollection
          .aggregate([
            {
              $match: { buyerId: uid },
            },
            {
              $lookup: {
                from: "products",
                localField: "productId",
                foreignField: "_id",
                as: "product",
              },
            },
            {
              $lookup: {
                from: "users",
                localField: "sellerId",
                foreignField: "uid",
                as: "seller",
              },
            },
            {
              $project: {
                _id: 1,
                buyerPhoneNumber: 1,
                meetUpLocation: 1,
                productId: 1,
                paymentStatus: 1,
                "product.name": 1,
                "product.images": 1,
                "product.sellingPrice": 1,
                "product.status": 1,
                "seller.fullName": 1,
                "seller.email": 1,
                "seller.profilePhoto.display_url": 1,
              },
            },
          ])
          .toArray();
        return res.send(result);
      } catch (err) {
        console.log(err);
        return res.sendStatus(500);
      }
    });

    app.patch("/bookings/:id", verifyJWT, async (req, res) => {
      try {
        const id = req.params.id;
        const payload = req.body;
        const uid = req.query.uid;

        // console.log(id, payload);

        if (uid !== req.decoded.uid) return res.sendStatus(403);

        const result = await bookingCollection.updateOne(
          { _id: ObjectId(id) },
          {
            $set: {
              ...payload,
            },
          }
        );
        // console.log(result);
        return res.send(result);
      } catch (error) {
        return res.sendStatus(500);
      }
    });
    /************* Bookings End *************/

    /************* REPORTS START *************/
    app.post("/reports", verifyJWT, async (req, res) => {
      try {
        const payload = req.body;
        if (payload.reporterId !== req.decoded.uid) return res.sendStatus(403);
        // console.log(payload);
        const doc = {
          productId: ObjectId(payload.productId),
          reporterId: payload.reporterId, //firebase uid
          reason: payload.reason,
        };
        const result = await reportCollection.insertOne(doc);
        return res.send(result);
      } catch (error) {
        return res.sendStatus(500);
      }
    });

    app.get("/reports", verifyJWT, async (req, res) => {
      try {
        const admin = await userCollection
          .find({ uid: req.decoded.uid })
          .toArray();
        if (admin.length === 0) return res.sendStatus(401);
        if (admin[0].role !== "admin") return res.sendStatus(403);

        const reports = await reportCollection
          .aggregate([
            {
              $lookup: {
                from: "products",
                localField: "productId",
                foreignField: "_id",
                as: "product",
              },
            },
            {
              $lookup: {
                from: "users",
                localField: "reporterId",
                foreignField: "uid",
                as: "reporter",
              },
            },
          ])
          .toArray();

        return res.send(reports);
      } catch (error) {
        return res.sendStatus(500);
      }
    });

    app.delete("/reports", verifyJWT, async (req, res) => {
      try {
        const id = req.query.id;
        const uid = req.query.uid;
        // console.log(id, uid);
        if (uid !== req.decoded.uid) return res.sendStatus(403);

        const report = await reportCollection
          .find({ _id: ObjectId(id) })
          .toArray();

        if (report.length === 0) return res.sendStatus(404);

        const admin = await userCollection.find({ uid }).toArray();

        if (admin.length === 0) return res.sendStatus(401);

        if (admin[0].role !== "admin") return res.sendStatus(403);

        const result = await reportCollection.deleteOne({ _id: ObjectId(id) });

        return res.send(result);
      } catch (error) {
        return res.sendStatus(500);
      }
    });
    /************** REPORTS END **************/

    /************** PAYMENT **************/
    // creating stripe payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      try {
        const price = req.body.price * 100;

        // console.log(price);
        if (!price) return res.sendStatus(400);

        const paymentIntent = await stripe.paymentIntents.create({
          amount: price,
          currency: "usd",
          payment_method_types: ["card"],
        });
        // console.log(paymentIntent.client_secret);
        return res.send(paymentIntent.client_secret);
      } catch (error) {
        return res.sendStatus(500);
      }
    });
  } finally {
  }
}

run().catch((err) => console.log(err));

/************* JWT START *************/
app.post("/get-access-token", (req, res) => {
  const user = req.body;
  const payload = {
    uid: user.uid,
    email: user.email,
  };

  // console.log(payload);

  const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET);

  res.send({ accessToken });
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  // console.log(authHeader);
  const token = authHeader && authHeader.split(" ")[1];
  if (token === null) return res.sendStatus(401);

  // console.log(token);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) return res.sendStatus(403);

    req.decoded = decoded;

    next();
  });
}
/************** JWT END **************/

app.get("/", (_req, res) => {
  res.send("uPhone server is running...");
});

app.listen(port, () =>
  console.log("uPhone server is running successfully on port ", port)
);
