const express = require('express');
const morgan = require('morgan');
const flash = require("express-flash");
const session = require("express-session");
const TodoList = require("./lib/todolist");

const app = express();
const host = "localhost";
const port = 3000;

let todoLists = require("./lib/seed-data");

app.set("views", "./views"); //tells express where to find templates
app.set("view engine", "pug"); //tells express to use Pug as the view engine

app.use(morgan("common"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false}));
app.use(session({
  name: "launch-school-todos-session-id",
  resave: false,
  saveUninitialized: true,
  secret: "this is not very secure",
}));

// Compare todo list titles alphabetically
const compareByTitle = (todoListA, todoListB) => {
  let titleA = todoListA.title.toLowerCase();
  let titleB = todoListB.title.toLowerCase();

  if (titleA < titleB) {
    return -1;
  } else if (titleA > titleB) {
    return 1;
  } else {
    return 0;
  }
};

// return the list of todo lists sorted by completion status and title.
const sortTodoLists = lists => {
  let undone = lists.filter(todoList => !todoList.isDone());
  let done   = lists.filter(todoList => todoList.isDone());
  undone.sort(compareByTitle);
  done.sort(compareByTitle);
  return [].concat(undone, done);
};

app.get("/", (req, res) => {
  res.redirect("/lists");
});

app.get("/lists", (req, res) => {
  res.render("lists", {
    todoLists: sortTodoLists(todoLists),
  });
});

app.get("/lists/new", (req, res) => {
  res.render("new-list")
});

app.post("/lists", (req, res) => {
  let title = (req.body.todoListTitle.trim());
  if (title.length === 0) {
    res.render("new-list", {
      errorMessage: "A title was not provided.",
    });
  } else if (title.length > 100) {
    res.render("new-list", {
      errorMessage: "List title must be between 1 and 100 characters.",
      todoListTitle: title,
    });
  } else if (todoLists.some(list => list.title === title)) {
    res.render("new-list", {
      errorMessage: "List title must be unique",
      todoListTitle: title,
    });
  } else {
    todoLists.push(new TodoList(title));
    res.redirect("/lists");
  }
});

//listener
app.listen(port, host, () => {
  console.log(`Todos is listening on port ${port} of ${host}!`);
});