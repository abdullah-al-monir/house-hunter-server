const express = require("express");

const port = process.env.port || 7000;

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("House Hunter is running");
});

app.listen(port, () => {
  console.log("House Hunter is running on port", port);
});
