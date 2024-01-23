const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = process.env.PORT || 7000;
const mongoURI = process.env.MONGO_URI;

// middlewares
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" });
    }
    req.user = user;
    next();
  });
};

const client = new MongoClient(mongoURI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
const userCollection = client.db("houseHunterDB").collection("users");

async function run() {
  try {
    await client.connect();
    app.post("/users", async (req, res) => {
      try {
        const { name, role, email, number, password, dp } = req.body;
        const existingUser = await userCollection.findOne({ email });

        if (existingUser) {
          return res
            .status(400)
            .json({ message: "User with this email already exists" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await userCollection.insertOne({
          name,
          role,
          email,
          number,
          password: hashedPassword,
          dp,
        });
        const token = jwt.sign(
          {
            name,
            role,
            email,
            number,
            password: hashedPassword,
            dp,
          },
          process.env.JWT_SECRET
        );

        res.json({ result, token });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });
    app.get("/user", async (req, res) => {
      const userEmail = req.query.email;
      const query = { email: userEmail };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.post("/login", async (req, res) => {
      try {
        const { email, password } = req.body;
        const user = await userCollection.findOne({ email });
        const matched = await bcrypt.compare(password, user.password);
        if (user && matched) {
          const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET);

          res.json({ token });
        } else {
          res.status(401).json({ message: "Invalid credentials" });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("House is running");
});

app.listen(port, () => {
  console.log("House Hunter is running on port", port);
});
