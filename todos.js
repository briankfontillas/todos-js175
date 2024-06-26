const express = require('express');
const morgan = require('morgan');
const flash = require("express-flash");
const session = require("express-session");
const { body, validationResult } = require("express-validator");
const TodoList = require("./lib/todolist");
const Todo = require("./lib/todo");
const { sortTodoLists, sortTodos } = require("./lib/sort");
const store = require("connect-loki");

const app = express();
const host = "localhost";
const port = 3000;
const LokiStore = store(session);

// let todoLists = require("./lib/seed-data");

app.set("views", "./views"); //tells express where to find templates
app.set("view engine", "pug"); //tells express to use Pug as the view engine

app.use(session({
  cookie: {
    httpOnly: true,
    maxAge: 31 * 24 * 60 * 60 * 1000, // 31 days in millseconds
    path: "/",
    secure: false,
  },
  name: "launch-school-todos-session-id",
  resave: false,
  saveUninitialized: true,
  secret: "this is not very secure",
  store: new LokiStore({}),
}));
app.use((req, res, next) => {
  let todoLists = [];
  if ("todoLists" in req.session) {
    req.session.todoLists.forEach(todoList => {
      todoLists.push(TodoList.makeTodoList(todoList));
    });
  }

  req.session.todoLists = todoLists;
  next();
});
app.use(morgan("common"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false}));
app.use(session({
  name: "launch-school-todos-session-id",
  resave: false,
  saveUninitialized: true,
  secret: "this is not very secure",
}));
app.use(flash());
app.use((req, res, next) => {
  if (!("todoLists" in req.session)) {
    req.session.todoLists = [];
  }

  next();
});
app.use((req, res, next) => {
  // console.log(req.method, typeof req.session.flash, req.session.flash);
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

// Find a todo list with the indicated ID. Returns `undefined` if not found.
const loadToDoList = (todoListId, todoLists) => {
  return todoLists.find(todoList => todoList.id === todoListId);
};

// Find a todo with the indicated ID in the indicated todo list
const loadTodo = (todoListId, todoId, todoLists) => {
  let todoList = loadToDoList(todoListId, todoLists);
  if (!todoList) return undefined;

  return todoList.todos.find(todo => todo.id === todoId);
};

app.get("/", (req, res) => {
  res.redirect("/lists");
});

app.get("/lists", (req, res) => {
  res.render("lists", {
    todoLists: sortTodoLists(req.session.todoLists),
    flash: req.flash(),
  });
});

app.get("/lists/new", (req, res) => {
  res.render("new-list")
});

app.post("/lists",
  [
    body("todoListTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The list title is required.")
      .isLength({ max: 100 })
      .withMessage("List title must be between 1 and 100 characters.")
      .custom((title, { req }) => {
        let todoLists = req.session.todoLists;
        let duplicate = todoLists.find(list => list.title === title);
        return duplicate === undefined;
      })
      .withMessage("List title must be unique."),
  ],
  (req, res) => {
    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach(message => req.flash("error", message.msg));
      res.render("new-list", {
        flash: req.flash(),
        todoListTitle: req.body.todoListTitle,
      });
    } else {
      req.session.todoLists.push(new TodoList(req.body.todoListTitle));
      req.flash("success", "The todolist has been created.");
      res.redirect("/lists");
    }
  }
);

app.get("/lists/:todoListId", (req, res, next) => {
  let todoListId = req.params.todoListId;
  let todoList = loadToDoList(+todoListId, req.session.todoLists);

  if (todoList === undefined) {
    next(new Error("Not found."));
  } else {
    res.render("list", {
      todoList: todoList,
      todos: sortTodos(todoList),
    });
  }
});

app.get("/lists/:todoListId/edit", (req, res, next) => {
  let todoListId = req.params.todoListId;
  let todoList = loadToDoList(+todoListId, req.session.todoLists);

  if (!todoList) {
    next(new Error("Not found."));
  } else {
    res.render("edit-list", { todoList });
  }
});

app.post("/lists/:todoListId/todos/:todoId/toggle", (req, res, next) => {
  let { todoListId, todoId } = { ...req.params };
  let todo = loadTodo(+todoListId, +todoId, req.session.todoLists);

  if (!todo) {
    next(new Error("Not found."));
  } else {
    let title = todo.title;
    if (todo.isDone()) {
      todo.markUndone();
      req.flash("success", `"${title}" marked as NOT done!`);
      res.redirect(`/lists/${todoListId}`);
    } else {
      todo.markDone();
      req.flash("success", `"${title}" marked as done.`);
      res.redirect(`/lists/${todoListId}`);
    }
  }
});

app.post("/lists/:todoListId/todos/:todoId/destroy", (req, res, next) => {
  let { todoListId, todoId } = { ...req.params };
  let todoList = loadToDoList(+todoListId, req.session.todoLists);
  let todo = loadTodo(+todoListId, +todoId, req.session.todoLists);

  if(!todo) {
    next(new Error("Not found."));
  } else {
    let title = todo.title;
    let todoToRemoveIndex = todoList.findIndexOf(todo);
    todoList.removeAt(todoToRemoveIndex);
    req.flash("success", `"${title} has been deleted!"`);
    res.redirect(`/lists/${todoListId}`);
  }
});

app.post("/lists/:todoListId/complete_all", (req, res, next) => {
  let todoListId = req.params.todoListId;
  let todoList = loadToDoList(+todoListId, req.session.todoLists);

  if (!todoList) {
    next(new Error("Not found."));
  } else {
    todoList.markAllDone();
    req.flash("success", "All todo's have been marked done!");
    res.redirect(`/lists/${todoListId}`);
  }
});

app.post("/lists/:todoListId/todos",
  [
    body("todoTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Todo title is required.")
      .isLength({ max: 100})
      .withMessage("List title must be between 1 and 100 characters.")
  ],
  (req, res, next) => {
    let todoListId = req.params.todoListId;
    let todoList = loadToDoList(+todoListId, req.session.todoLists);
    if (!todoList) {
      next(new Error("Not found."));
    } else {
      let errors = validationResult(req);
      if (!errors.isEmpty()) {
        errors.array().forEach(message => req.flash("error", message.msg));
        res.render("list", {
          flash: req.flash(),
          todoTitle: req.body.todoTitle,
          todoList: todoList,
          todos: todoList.todos,
        });
      } else {
          let title = req.body.todoTitle;
          todoList.add(new Todo(title));
          req.flash("success", `"${title}" added to the list!`);
          res.redirect(`/lists/${todoListId}`);
        }
      }
});

app.post("/lists/:todoListId/destroy", (req, res, next) => {
  let todoLists = req.session.todoLists;
  let todoListId = +req.params.todoListId;
  let index = todoLists.findIndex(todoList => todoList.id === todoListId);

  if (index === -1) {
    next(new Error("Not found."));
  } else {
    req.session.todoLists.splice(index, 1);

    req.flash("success", "Todo list deleted.");
    res.redirect("/lists");
  }
});

app.post("/lists/:todoListId/edit",
  [
    body("todoListTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The list title is required.")
      .isLength({ max: 100 })
      .withMessage("List title must be between 1 and 100 characters.")
      .custom((title, { req }) => {
        let todoLists = req.session.todoLists;
        let duplicate = todoLists.find(list => list.title === title);
        return duplicate === undefined;
      })
      .withMessage("List title must be unique."),
  ],
  (req, res, next) => {
    let todoListId = req.params.todoListId;
    let todoList = loadToDoList(+todoListId, req.session.todoLists);
    
    if (!todoList) {
      next(new Error("Not found."));
    } else {
      let errors = validationResult(req);
      if (!errors.isEmpty()) {
        errors.array().forEach(message => req.flash("error", message.msg));
        res.render("edit-list", {
          flash: req.flash(),
          todoTitle: req.body.todoTitle,
          todoList: todoList,
        });
      } else {
        let title = req.body.todoListTitle;
        todoList.setTitle(title);

        req.flash("success", `Todo list renamed to ${title}!`);
        res.redirect(`/lists/${todoListId}`);
      }
    }
  }
);

app.use((err, req, res, _next) => {
  console.log(err);
  res.status(404).send(err.message);
});

//listener
app.listen(port, host, () => {
  console.log(`Todos is listening on port ${port} of ${host}!`);
});