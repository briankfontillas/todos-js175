const express = require('express');
const morgan = require('morgan');

const app = express();
const host = "localhost";
const port = 3000;

let todoLists = require("./lib/seed-data");

app.set("views", "./views"); //tells express where to find templates
app.set("view engine", "pug"); //tells express to use Pug as the view engine

app.use(morgan("common"));
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.render("lists", { todoLists });
});

//listener
app.listen(port, host, () => {
  console.log(`Todos is listening on port ${port} of ${host}!`);
});