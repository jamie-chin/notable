import express from "express";
import { createServer } from "http";
import pg from "pg";
import cors from "cors";
import { Server } from "socket.io";
import {
	requiresLogin,
	generateAccessToken,
	addAdminRoutes,
	sql,
	addPresentationManagementRoutes,
} from "./helpers.js";

//initialize postgres connection
const { Pool } = pg;
const pool = new Pool({
	connectionString:
		process.env.DATABASE_URL ||
		"postgres://postgres:postgres@localhost/notable",
	ssl: process.env.DATABASE_URL
		? {
				rejectUnauthorized: false,
		  }
		: false,
});

//setup constants
const PORT = process.env.PORT || 5000;
const __dirname = import.meta.url
	.replace("file://", "")
	.replace("/index.js", "");

//initialize express
const app = express();

app.use(express.static("client/build"));
app.use(express.json());
app.use(
	cors({
		origin: [
			`http://localhost:${PORT}`,
			`https://stormy-plateau-24106.herokuapp.com`,
		],
	})
);

// Socket.io section
const server = createServer(app);
const io = new Server(server);

const users = [];

io.on("connection", (socket) => {
	console.log("User Connected", socket.id);

	socket.on("join_room", (data) => {
		socket.join(data.room);
		console.log(`User with ID: ${socket.id} joined room: ${data.room}`);
		const user = {
			room: data.room,
			name: data.name,
			id: socket.id,
		};
		users.push(user);
		console.log("All users: ", users);
		socket.broadcast.to(data.room).emit(
			"user_list",
			users.filter((user) => user.room === data.room)
		);
	});

	socket.on("disconnect", () => {
		console.log("User Disconnected", socket.id);
	});
});

// API section

app.post("/api/login", async (req, res) => {
	const { username, password } = req.body;
	const result = await pool.query(
		"SELECT * FROM users WHERE username = $1 AND password = $2",
		[username, password]
	);
	if (result.rows.length === 0) {
		console.log(result);
		console.log(req.body);
		res.status(403).send("Invalid username or password");
	} else {
		const token = generateAccessToken(result.rows[0].id, result.rows[0].admin);
		res.json({
			token,
			user: {
				id: result.rows[0].id,
				username,
				isAdmin: result.rows[0].admin,
				name: result.rows[0].name,
			},
		});
	}
});

app.post("/api/register", async (req, res) => {
	const { username, password, name } = req.body;
	try {
		const result = await pool.query(
			sql`INSERT INTO users (username, password, name) VALUES ($1, $2, $3) RETURNING *`,
			[username, password, name]
		);
		if (result.rowCount === 0) {
			res.status(400).send("Username already exists");
		} else {
			const token = generateAccessToken(
				result.rows[0].id,
				result.rows[0].admin
			);
			res.json({ token });
		}
	} catch (err) {
		if (err.code === "23505") {
			res.status(400).send("Username already exists");
		} else {
			console.error(err);
			res.status(500).send("Internal server error");
		}
	}
});

// save user notes from PDFnotes to db
app.post("/api/addNote", requiresLogin, async (req, res) => {
	const { note, timestamp, pageNumber, presentationId } = req.body;
	const result = await pool.query(
		sql`INSERT INTO notes (note, time_stamp, page_number, notetaker_id, presentation_id) 
		VALUES ($1, $2, $3, $4, $5)`,
		[note, timestamp, pageNumber, req.jwt.id, parseInt(presentationId)]
	);
	if (result.rowCount) {
		res.send("Note saved to database");
	} else {
		res.status(400).send("invalid request");
	}
});

app.delete("/api/presentationNotes/:id", requiresLogin, async (req, res) => {
	const { id } = req.params;
	console.log(id);
	console.log(req.jwt.id);
	await pool.query(
		sql`DELETE FROM notes WHERE presentation_id = $1 AND notetaker_id = $2`,
		[parseInt(id), req.jwt.id]
	);
	res.send("All notes for this presentation have been deleted.");
});
app.get("/api/notePresentations/", requiresLogin, async (req, res) => {
	const result = await pool.query(
		sql`SELECT * FROM presentations WHERE presentation_instance_id IN 
		(SELECT DISTINCT presentation_id FROM notes WHERE notetaker_id = $1)`,
		[req.jwt.id]
	);
	res.send(result.rows);
});

addAdminRoutes(app, pool);
addPresentationManagementRoutes(app, pool);

app.get("/*", (req, res) => {
	res.sendFile(`${__dirname}/client/build/index.html`);
});

server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
