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

function run() {
  try {
    const userCollection = client.db("uPhone").databaseName("users");

    /************* USERS START *************/
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { uid: user.uid };
      const hasRecord = await userCollection.findOne(query);

      console.log("user has record", hasRecord);

      if (user.role === "admin") res.sendStatus(406);
      else if (hasRecord) {
        res.sendStatus(200);
      } else {
        const document = {
          uid: user.uid,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        };
        const response = await userCollection.updateOne(document);

        console.log("Create user = ", response);

        res.sendStatus(201);
      }
    });
    /************* USERS END *************/
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
