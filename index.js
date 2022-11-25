require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");

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
    const userCollection = client.db("uPhone").collection("users");
    const productCollection = client.db("uPhone").collection("products");

    /************* USERS START *************/
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { uid: user.uid };

      const hasRecord = await userCollection.find(query).toArray();

      // console.log("hasRecord", hasRecord);

      if (user.role === "admin") res.sendStatus(406);
      else if (hasRecord.length > 0) {
        res.sendStatus(200);
      } else {
        const document = {
          uid: user.uid,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        };

        await userCollection.insertOne(document);

        res.sendStatus(201);
      }
    });
    /************* USERS END *************/

    /************* PRODUCTS START *************/
    app.post("/products", verifyJWT, async (req, res) => {
      const data = req.body;
      if (!data.uid) return res.send(401);

      try {
        const user = await userCollection.find({ uid: data.uid }).toArray();
        if (user[0].role === "admin" || user[0].role === "seller") {
          const doc = {
            name: data.productName,
            images: data.images,
            moreDetails: data.moreDetails,
            sellingPrice: data.sellingPrice,
            originalPrice: data.originalPrice,
            meetUpLocation: data.meetUpLocation,
            brand: data.brand,
            brandId: data.brandId,
            sellerEmail: data.email,
            sellerId: data.uid,
            status: "available",
            advertise: false,
          };
          const response = await productCollection.insertOne(doc);
          console.log("Line-71", response);
          return res.send(response);
        }
        //if user is neither seller nor admin
        return res.sendStatus(403);
      } catch (error) {
        console.error(error);
        return res.sendStatus(400);
      }
    });
    /************** PRODUCTS END **************/
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

  const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET);

  res.send({ accessToken });
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  console.log(authHeader);
  const token = authHeader && authHeader.split(" ")[1];
  if (token === null) return res.sendStatus(401);

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
