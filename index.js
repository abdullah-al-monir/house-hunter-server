const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 7000;
const mongoURI = process.env.MONGO_URI;

// middlewares
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173", "https://house-hunter-d21c8.web.app"],
    credentials: true,
  })
);

const verifyToken = (req, res, next) => {
  const token = req?.headers.authorization;
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" });
    }
    req.user = decoded;
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
const houseCollection = client.db("houseHunterDB").collection("houses");

async function run() {
  try {
    // await client.connect();
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

        res.json({
          result,
          token,
          user: {
            name,
            role,
            email,
            number,
            dp,
          },
        });
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

          res.json({ token, user });
        } else {
          res.status(401).json({ message: "Invalid credentials" });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // to get houses
    app.get("/houses", async (req, res) => {
      const search = req.query.search;
      const bedrooms = req.query.bedrooms;
      const bathrooms = req.query.bathrooms;
      const totalRooms = req.query.totalRooms;
      const city = req.query.city;
      const rentRange = req.query.rentRange;
      const ownerEmail = req.query.email;
      const query = {};
      const filters = [];

      if (rentRange) {
        const [minPrice, maxPrice] = rentRange.split("-");
        filters.push({
          rentPerMonth: {
            $gte: parseInt(minPrice),
            $lte: parseInt(maxPrice),
          },
        });
      }

      if (search) {
        filters.push({
          $or: [
            { city: { $regex: search, $options: "i" } },
            { bedrooms: { $regex: search, $options: "i" } },
            { bathrooms: { $regex: search, $options: "i" } },
            { address: { $regex: search, $options: "i" } },
            { homeSizeSqFt: { $regex: search, $options: "i" } },
          ],
        });
      }

      if (bedrooms) {
        filters.push({ bedrooms: parseInt(bedrooms) });
      }
      if (bathrooms) {
        filters.push({ bathrooms: parseInt(bathrooms) });
      }
      if (totalRooms) {
        filters.push({ totalRooms: parseInt(totalRooms) });
      }

      if (city) {
        filters.push({ city: { $regex: city, $options: "i" } });
      }
      if (ownerEmail) {
        filters.push({ ownerEmail: { $regex: ownerEmail, $options: "i" } });
      }

      if (filters.length > 0) {
        query.$and = filters;
      }
      const result = await houseCollection.find(query).toArray();
      res.send(result);
    });

    // to add a new house info
    app.post("/houses", async (req, res) => {
      const houseInfo = req.body;
      const result = await houseCollection.insertOne(houseInfo);
      res.send(result);
    });
    // to get a single house
    app.get("/house/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await houseCollection.findOne(query);
      res.send(result);
    });
    // to update a single house info
    app.put("/house/:_id", async (req, res) => {
      const id = req.params._id;
      const updatedHouse = req.body;
      const filter = { _id: new ObjectId(id) };
      const update = {
        $set: {
          name: updatedHouse.name,
          city: updatedHouse.city,
          ownerName: updatedHouse.ownerName,
          ownerEmail: updatedHouse.ownerEmail,
          contactNumber: updatedHouse.contactNumber,
          rentPerMonth: updatedHouse.rentPerMonth,
          availability: updatedHouse.availability,
          description: updatedHouse.description,
          location: updatedHouse.location,
          bedrooms: updatedHouse.bedrooms,
          bathrooms: updatedHouse.bathrooms,
          totalRooms: updatedHouse.totalRooms,
          image: updatedHouse.image,
          homeSizeSqFt: updatedHouse.homeSizeSqFt,
        },
      };
      const result = await houseCollection.updateOne(filter, update);
      res.send(result);
    });
    //  to delete a house info
    app.delete("/house/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await houseCollection.deleteOne(query);
      res.send(result);
    });
    // await client.db("admin").command({ ping: 1 });
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
