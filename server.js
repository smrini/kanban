// Load environment variables
require("dotenv").config();

const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || "development";
3001;

// CORS configuration
const corsOptions = {
	origin: function (origin, callback) {
		// Allow requests with no origin (like mobile apps or curl requests)
		if (!origin) return callback(null, true);

		const allowedOrigins = process.env.CORS_ORIGINS
			? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
			: ["http://localhost:3001"];

		if (allowedOrigins.indexOf(origin) !== -1) {
			callback(null, true);
		} else {
			callback(new Error("Not allowed by CORS"));
		}
	},
	credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.static("public"));
app.use(
	"/fontawesome",
	express.static(
		path.join(__dirname, "node_modules/@fortawesome/fontawesome-free")
	)
);

// Security headers for production
if (NODE_ENV === "production") {
	app.use((req, res, next) => {
		res.setHeader("X-Content-Type-Options", "nosniff");
		res.setHeader("X-Frame-Options", "DENY");
		res.setHeader("X-XSS-Protection", "1; mode=block");
		res.setHeader(
			"Strict-Transport-Security",
			"max-age=31536000; includeSubDomains"
		);
		next();
	});
}

// Initialize MySQL database connection with environment variables
const db = mysql.createConnection({
	host: process.env.DB_HOST || "localhost",
	user: process.env.DB_USER || "root",
	password: process.env.DB_PASSWORD || "",
	database: process.env.DB_NAME || "kanban_db",
	port: process.env.DB_PORT || 3306,
	acquireTimeout: 60000,
	timeout: 60000,
});

// Error handling middleware
app.use((err, req, res, next) => {
	console.error("Error:", err.message);

	if (NODE_ENV === "production") {
		res.status(500).json({ error: "Internal server error" });
	} else {
		res.status(500).json({ error: err.message, stack: err.stack });
	}
});

// Connect to database
db.connect((err) => {
	if (err) {
		console.error("Error connecting to MySQL database:", err.message);
		process.exit(1);
	} else {
		console.log("Connected to MySQL database");
		initializeDatabase();
	}
});

// Initialize database tables
function initializeDatabase() {
	// Boards table
	db.query(
		`
        CREATE TABLE IF NOT EXISTS boards (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `,
		(err) => {
			if (err) console.error("Error creating boards table:", err);
		}
	);

	// Lists table
	db.query(
		`
        CREATE TABLE IF NOT EXISTS lists (
            id INT AUTO_INCREMENT PRIMARY KEY,
            board_id INT,
            title VARCHAR(255) NOT NULL,
            position INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
        )
    `,
		(err) => {
			if (err) console.error("Error creating lists table:", err);
		}
	);

	// Cards table
	db.query(
		`
        CREATE TABLE IF NOT EXISTS cards (
            id INT AUTO_INCREMENT PRIMARY KEY,
            list_id INT,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            position INT NOT NULL,
            priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
            due_date DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
        )
    `,
		(err) => {
			if (err) console.error("Error creating cards table:", err);
		}
	);

	// Clients table
	db.query(
		`
        CREATE TABLE IF NOT EXISTS clients (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE,
            phone VARCHAR(50),
            company VARCHAR(255),
            address TEXT,
            status ENUM('active', 'inactive', 'prospect') DEFAULT 'active',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `,
		(err) => {
			if (err) console.error("Error creating clients table:", err);
		}
	);

	// Workers table
	db.query(
		`
        CREATE TABLE IF NOT EXISTS workers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE,
            phone VARCHAR(50),
            position VARCHAR(255),
            department VARCHAR(255),
            address TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `,
		(err) => {
			if (err) console.error("Error creating workers table:", err);
		}
	);

	// Create default board and lists if they don't exist
	db.query("SELECT COUNT(*) as count FROM boards", (err, results) => {
		if (err) {
			console.error("Error checking boards:", err);
			return;
		}
		if (results[0].count === 0) {
			createDefaultData();
		}
	});
}

function createDefaultData() {
	db.query(
		"INSERT INTO boards (title, description) VALUES (?, ?)",
		["KanBan Board", "Welcome to your Kanban board!"],
		function (err, result) {
			if (err) return console.error(err);

			const boardId = result.insertId;
			const defaultLists = [
				{ title: "To Do", position: 0 },
				{ title: "In Progress", position: 1 },
				{ title: "Done", position: 2 },
			];

			defaultLists.forEach((list) => {
				db.query(
					"INSERT INTO lists (board_id, title, position) VALUES (?, ?, ?)",
					[boardId, list.title, list.position],
					(err) => {
						if (err)
							console.error("Error creating default list:", err);
					}
				);
			});
		}
	);
}

// API Routes

// Get all boards
app.get("/api/boards", (req, res) => {
	db.query(
		"SELECT * FROM boards ORDER BY created_at DESC",
		(err, results) => {
			if (err) {
				res.status(500).json({ error: err.message });
				return;
			}
			res.json(results);
		}
	);
});

// Get board with lists and cards
app.get("/api/boards/:id", (req, res) => {
	const boardId = req.params.id;

	// Get board info
	db.query(
		"SELECT * FROM boards WHERE id = ?",
		[boardId],
		(err, boardResults) => {
			if (err) {
				res.status(500).json({ error: err.message });
				return;
			}
			if (boardResults.length === 0) {
				res.status(404).json({ error: "Board not found" });
				return;
			}

			const board = boardResults[0];

			// Get lists for this board
			db.query(
				"SELECT * FROM lists WHERE board_id = ? ORDER BY position",
				[boardId],
				(err, lists) => {
					if (err) {
						res.status(500).json({ error: err.message });
						return;
					}

					// Get cards for each list
					const listPromises = lists.map((list) => {
						return new Promise((resolve, reject) => {
							db.query(
								"SELECT * FROM cards WHERE list_id = ? ORDER BY position",
								[list.id],
								(err, cards) => {
									if (err) reject(err);
									else {
										// Fix: Format dates properly to avoid timezone issues
										const formattedCards = cards.map(
											(card) => {
												let formattedDueDate = null;

												if (card.due_date) {
													if (
														card.due_date instanceof
														Date
													) {
														// Format date as YYYY-MM-DD using local timezone
														const year =
															card.due_date.getFullYear();
														const month = String(
															card.due_date.getMonth() +
																1
														).padStart(2, "0");
														const day = String(
															card.due_date.getDate()
														).padStart(2, "0");
														formattedDueDate = `${year}-${month}-${day}`;
													} else if (
														typeof card.due_date ===
														"string"
													) {
														// If it's already a string, ensure it's in YYYY-MM-DD format
														formattedDueDate =
															card.due_date.split(
																"T"
															)[0];
													} else {
														formattedDueDate =
															card.due_date;
													}
												}

												return {
													...card,
													due_date: formattedDueDate,
												};
											}
										);
										resolve({
											...list,
											cards: formattedCards,
										});
									}
								}
							);
						});
					});

					Promise.all(listPromises)
						.then((listsWithCards) => {
							res.json({ ...board, lists: listsWithCards });
						})
						.catch((err) => {
							res.status(500).json({ error: err.message });
						});
				}
			);
		}
	);
});

// Create new board
app.post("/api/boards", (req, res) => {
	const { title, description } = req.body;
	db.query(
		"INSERT INTO boards (title, description) VALUES (?, ?)",
		[title, description || ""],
		function (err, result) {
			if (err) {
				res.status(500).json({ error: err.message });
				return;
			}
			res.json({ id: result.insertId, title, description });
		}
	);
});

// Create new list
app.post("/api/lists", (req, res) => {
	const { board_id, title } = req.body;

	// Get the next position
	db.query(
		"SELECT COALESCE(MAX(position), -1) + 1 as nextPos FROM lists WHERE board_id = ?",
		[board_id],
		(err, results) => {
			if (err) {
				res.status(500).json({ error: err.message });
				return;
			}

			const position = results[0].nextPos;

			db.query(
				"INSERT INTO lists (board_id, title, position) VALUES (?, ?, ?)",
				[board_id, title, position],
				function (err, result) {
					if (err) {
						res.status(500).json({ error: err.message });
						return;
					}
					res.json({
						id: result.insertId,
						board_id,
						title,
						position,
						cards: [],
					});
				}
			);
		}
	);
});

// Create new card - Updated to handle priority and due_date
app.post("/api/cards", (req, res) => {
	const { list_id, title, description, due_date, priority } = req.body;

	console.log("Received card creation request:", {
		list_id,
		title,
		description,
		due_date,
		priority,
	});

	// Get the next position
	db.query(
		"SELECT COALESCE(MAX(position), -1) + 1 as nextPos FROM cards WHERE list_id = ?",
		[list_id],
		(err, results) => {
			if (err) {
				res.status(500).json({ error: err.message });
				return;
			}

			const position = results[0].nextPos;

			// Handle date properly - ensure it stays as the same date
			let formattedDate = null;
			if (due_date && due_date.trim() !== "") {
				// Always ensure we're working with YYYY-MM-DD format only
				if (typeof due_date === "string") {
					// Extract just the date part, ignoring any time or timezone info
					formattedDate = due_date.split("T")[0];

					// Validate the date format
					if (!formattedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
						console.error(
							"Invalid date format received:",
							due_date
						);
						res.status(400).json({ error: "Invalid date format" });
						return;
					}
				} else {
					formattedDate = due_date;
				}
			}

			console.log("Original due_date:", due_date);
			console.log("Formatted date for storage:", formattedDate);

			db.query(
				"INSERT INTO cards (list_id, title, description, position, priority, due_date) VALUES (?, ?, ?, ?, ?, ?)",
				[
					list_id,
					title,
					description || "",
					position,
					priority || "medium",
					formattedDate,
				],
				function (err, result) {
					if (err) {
						console.error("Database error:", err);
						res.status(500).json({ error: err.message });
						return;
					}

					const responseData = {
						id: result.insertId,
						list_id,
						title,
						description: description || "",
						position,
						priority: priority || "medium",
						due_date: formattedDate, // Return the same format we stored
					};

					console.log("Returning card data:", responseData);
					res.json(responseData);
				}
			);
		}
	);
});

// Update card position (for drag and drop)
app.put("/api/cards/:id/move", (req, res) => {
	const cardId = req.params.id;
	const { list_id, position } = req.body;

	// Start a transaction
	db.beginTransaction((err) => {
		if (err) {
			res.status(500).json({ error: err.message });
			return;
		}

		// Get current card info
		db.query(
			"SELECT * FROM cards WHERE id = ?",
			[cardId],
			(err, results) => {
				if (err) {
					return db.rollback(() => {
						res.status(500).json({ error: err.message });
					});
				}

				if (results.length === 0) {
					return db.rollback(() => {
						res.status(404).json({ error: "Card not found" });
					});
				}

				const currentCard = results[0];

				// If moving to the same list, adjust positions
				if (currentCard.list_id === list_id) {
					// Moving within the same list
					if (position > currentCard.position) {
						// Moving down: decrease position of cards between old and new position
						db.query(
							"UPDATE cards SET position = position - 1 WHERE list_id = ? AND position > ? AND position <= ?",
							[list_id, currentCard.position, position],
							(err) => {
								if (err) {
									return db.rollback(() => {
										res.status(500).json({
											error: err.message,
										});
									});
								}
								updateCardPosition();
							}
						);
					} else if (position < currentCard.position) {
						// Moving up: increase position of cards between new and old position
						db.query(
							"UPDATE cards SET position = position + 1 WHERE list_id = ? AND position >= ? AND position < ?",
							[list_id, position, currentCard.position],
							(err) => {
								if (err) {
									return db.rollback(() => {
										res.status(500).json({
											error: err.message,
										});
									});
								}
								updateCardPosition();
							}
						);
					} else {
						// Same position, no change needed
						db.commit((err) => {
							if (err) {
								return db.rollback(() => {
									res.status(500).json({
										error: err.message,
									});
								});
							}
							res.json({ success: true });
						});
						return;
					}
				} else {
					// Moving to different list
					// First, decrease positions in the old list
					db.query(
						"UPDATE cards SET position = position - 1 WHERE list_id = ? AND position > ?",
						[currentCard.list_id, currentCard.position],
						(err) => {
							if (err) {
								return db.rollback(() => {
									res.status(500).json({
										error: err.message,
									});
								});
							}

							// Then, increase positions in the new list
							db.query(
								"UPDATE cards SET position = position + 1 WHERE list_id = ? AND position >= ?",
								[list_id, position],
								(err) => {
									if (err) {
										return db.rollback(() => {
											res.status(500).json({
												error: err.message,
											});
										});
									}
									updateCardPosition();
								}
							);
						}
					);
				}

				function updateCardPosition() {
					// Finally, update the moved card
					db.query(
						"UPDATE cards SET list_id = ?, position = ? WHERE id = ?",
						[list_id, position, cardId],
						function (err) {
							if (err) {
								return db.rollback(() => {
									res.status(500).json({
										error: err.message,
									});
								});
							}
							db.commit((err) => {
								if (err) {
									return db.rollback(() => {
										res.status(500).json({
											error: err.message,
										});
									});
								}
								res.json({ success: true });
							});
						}
					);
				}
			}
		);
	});
});

app.put("/api/cards/:id", (req, res) => {
	const cardId = req.params.id;
	const updates = req.body;

	console.log("Received card update request:", { cardId, updates });

	// Get current card data first
	db.query("SELECT * FROM cards WHERE id = ?", [cardId], (err, results) => {
		if (err) {
			console.error("Error fetching current card:", err);
			res.status(500).json({ error: err.message });
			return;
		}

		if (results.length === 0) {
			res.status(404).json({ error: "Card not found" });
			return;
		}

		const currentCard = results[0];
		console.log("Current card data:", currentCard);

		// Merge current data with updates
		const updatedData = {
			title:
				updates.title !== undefined ? updates.title : currentCard.title,
			description:
				updates.description !== undefined
					? updates.description
					: currentCard.description,
			priority:
				updates.priority !== undefined
					? updates.priority
					: currentCard.priority,
			due_date:
				updates.due_date !== undefined
					? updates.due_date
					: currentCard.due_date,
		};

		// Handle date properly - ensure it stays as the same date
		let formattedDate = null;
		if (updatedData.due_date && updatedData.due_date.trim() !== "") {
			// Always ensure we're working with YYYY-MM-DD format only
			if (typeof updatedData.due_date === "string") {
				// Extract just the date part, ignoring any time or timezone info
				formattedDate = updatedData.due_date.split("T")[0];

				// Validate the date format
				if (!formattedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
					console.error(
						"Invalid date format received:",
						updatedData.due_date
					);
					res.status(400).json({ error: "Invalid date format" });
					return;
				}
			} else {
				formattedDate = updatedData.due_date;
			}
		}

		console.log("Original due_date:", updatedData.due_date);
		console.log("Formatted date for storage:", formattedDate);

		db.query(
			"UPDATE cards SET title = ?, description = ?, priority = ?, due_date = ? WHERE id = ?",
			[
				updatedData.title,
				updatedData.description || "",
				updatedData.priority || "medium",
				formattedDate,
				cardId,
			],
			function (err) {
				if (err) {
					console.error("Error updating card:", err);
					res.status(500).json({ error: err.message });
					return;
				}

				console.log(
					"Card updated successfully with date:",
					formattedDate
				);
				res.json({
					success: true,
					due_date: formattedDate, // Return the formatted date
				});
			}
		);
	});
});

app.put("/api/lists/:id", (req, res) => {
	const listId = req.params.id;
	const { title } = req.body;

	db.query(
		"UPDATE lists SET title = ? WHERE id = ?",
		[title, listId],
		function (err) {
			if (err) {
				res.status(500).json({ error: err.message });
				return;
			}
			res.json({ success: true });
		}
	);
});

// Reorder list position (for drag and drop)
app.put("/api/lists/:id/reorder", (req, res) => {
	const listId = req.params.id;
	const { position } = req.body;

	// Start a transaction
	db.beginTransaction((err) => {
		if (err) {
			res.status(500).json({ error: err.message });
			return;
		}

		// Get current list info
		db.query(
			"SELECT * FROM lists WHERE id = ?",
			[listId],
			(err, results) => {
				if (err) {
					return db.rollback(() => {
						res.status(500).json({ error: err.message });
					});
				}

				if (results.length === 0) {
					return db.rollback(() => {
						res.status(404).json({ error: "List not found" });
					});
				}

				const currentList = results[0];

				// Get all lists in the same board to determine the correct positions
				db.query(
					"SELECT * FROM lists WHERE board_id = ? ORDER BY position",
					[currentList.board_id],
					(err, allLists) => {
						if (err) {
							return db.rollback(() => {
								res.status(500).json({ error: err.message });
							});
						}

						// Remove the current list from the array
						const otherLists = allLists.filter(
							(list) => list.id !== parseInt(listId)
						);

						// Insert the current list at the new position
						otherLists.splice(position, 0, currentList);

						// Update all list positions
						let updatePromises = otherLists.map((list, index) => {
							return new Promise((resolve, reject) => {
								db.query(
									"UPDATE lists SET position = ? WHERE id = ?",
									[index, list.id],
									(err) => {
										if (err) reject(err);
										else resolve();
									}
								);
							});
						});

						Promise.all(updatePromises)
							.then(() => {
								db.commit((err) => {
									if (err) {
										return db.rollback(() => {
											res.status(500).json({
												error: err.message,
											});
										});
									}
									res.json({ success: true });
								});
							})
							.catch((err) => {
								db.rollback(() => {
									res.status(500).json({
										error: err.message,
									});
								});
							});
					}
				);
			}
		);
	});
});

// Delete card
app.delete("/api/cards/:id", (req, res) => {
	const cardId = req.params.id;

	db.query("DELETE FROM cards WHERE id = ?", [cardId], function (err) {
		if (err) {
			res.status(500).json({ error: err.message });
			return;
		}
		res.json({ success: true });
	});
});

// Delete list
app.delete("/api/lists/:id", (req, res) => {
	const listId = req.params.id;

	db.query("DELETE FROM lists WHERE id = ?", [listId], function (err) {
		if (err) {
			res.status(500).json({ error: err.message });
			return;
		}
		res.json({ success: true });
	});
});

// ===== CLIENTS CRUD ROUTES =====

// Get all clients
app.get("/api/clients", (req, res) => {
	const { search, status, limit = 50, offset = 0 } = req.query;

	let query = "SELECT * FROM clients WHERE 1=1";
	const params = [];

	if (search) {
		query += " AND (name LIKE ? OR email LIKE ? OR company LIKE ?)";
		const searchTerm = `%${search}%`;
		params.push(searchTerm, searchTerm, searchTerm);
	}

	if (status && status !== "all") {
		query += " AND status = ?";
		params.push(status);
	}

	query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
	params.push(parseInt(limit), parseInt(offset));

	db.query(query, params, (err, results) => {
		if (err) {
			res.status(500).json({ error: err.message });
			return;
		}
		res.json(results);
	});
});

// Get client by ID
app.get("/api/clients/:id", (req, res) => {
	const clientId = req.params.id;

	db.query(
		"SELECT * FROM clients WHERE id = ?",
		[clientId],
		(err, results) => {
			if (err) {
				res.status(500).json({ error: err.message });
				return;
			}
			if (results.length === 0) {
				res.status(404).json({ error: "Client not found" });
				return;
			}
			res.json(results[0]);
		}
	);
});

// Create new client
app.post("/api/clients", (req, res) => {
	const { name, email, phone, company, address, status, notes } = req.body;

	if (!name) {
		res.status(400).json({ error: "Name is required" });
		return;
	}

	db.query(
		`INSERT INTO clients (name, email, phone, company, address, status, notes) 
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[
			name,
			email || null,
			phone || null,
			company || null,
			address || null,
			status || "active",
			notes || null,
		],
		function (err, result) {
			if (err) {
				if (err.code === "ER_DUP_ENTRY") {
					res.status(400).json({ error: "Email already exists" });
				} else {
					res.status(500).json({ error: err.message });
				}
				return;
			}
			res.json({
				id: result.insertId,
				name,
				email,
				phone,
				company,
				address,
				status: status || "active",
				notes,
			});
		}
	);
});

// Update client
app.put("/api/clients/:id", (req, res) => {
	const clientId = req.params.id;
	const { name, email, phone, company, address, status, notes } = req.body;

	if (!name) {
		res.status(400).json({ error: "Name is required" });
		return;
	}

	db.query(
		`UPDATE clients SET name = ?, email = ?, phone = ?, company = ?, address = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
		 WHERE id = ?`,
		[
			name,
			email || null,
			phone || null,
			company || null,
			address || null,
			status || "active",
			notes || null,
			clientId,
		],
		function (err, result) {
			if (err) {
				if (err.code === "ER_DUP_ENTRY") {
					res.status(400).json({ error: "Email already exists" });
				} else {
					res.status(500).json({ error: err.message });
				}
				return;
			}
			if (result.affectedRows === 0) {
				res.status(404).json({ error: "Client not found" });
				return;
			}
			res.json({ success: true });
		}
	);
});

// Delete client
app.delete("/api/clients/:id", (req, res) => {
	const clientId = req.params.id;

	db.query(
		"DELETE FROM clients WHERE id = ?",
		[clientId],
		function (err, result) {
			if (err) {
				res.status(500).json({ error: err.message });
				return;
			}
			if (result.affectedRows === 0) {
				res.status(404).json({ error: "Client not found" });
				return;
			}
			res.json({ success: true });
		}
	);
});

// ===== WORKERS CRUD ROUTES =====

// Get all workers
app.get("/api/workers", (req, res) => {
	const { search, department, limit = 50, offset = 0 } = req.query;

	let query = "SELECT * FROM workers WHERE 1=1";
	const params = [];

	if (search) {
		query += " AND (name LIKE ? OR email LIKE ? OR position LIKE ?)";
		const searchTerm = `%${search}%`;
		params.push(searchTerm, searchTerm, searchTerm);
	}

	if (department && department !== "all") {
		query += " AND department = ?";
		params.push(department);
	}

	query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
	params.push(parseInt(limit), parseInt(offset));

	db.query(query, params, (err, results) => {
		if (err) {
			res.status(500).json({ error: err.message });
			return;
		}
		res.json(results);
	});
});

// Get worker by ID
app.get("/api/workers/:id", (req, res) => {
	const workerId = req.params.id;

	db.query(
		"SELECT * FROM workers WHERE id = ?",
		[workerId],
		(err, results) => {
			if (err) {
				res.status(500).json({ error: err.message });
				return;
			}
			if (results.length === 0) {
				res.status(404).json({ error: "Worker not found" });
				return;
			}
			res.json(results[0]);
		}
	);
});

// Create new worker
app.post("/api/workers", (req, res) => {
	const { name, email, phone, position, department, address, notes } =
		req.body;

	if (!name) {
		res.status(400).json({ error: "Name is required" });
		return;
	}

	db.query(
		`INSERT INTO workers (name, email, phone, position, department, address, notes) 
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[
			name,
			email || null,
			phone || null,
			position || null,
			department || null,
			address || null,
			notes || null,
		],
		function (err, result) {
			if (err) {
				if (err.code === "ER_DUP_ENTRY") {
					res.status(400).json({ error: "Email already exists" });
				} else {
					res.status(500).json({ error: err.message });
				}
				return;
			}
			res.json({
				id: result.insertId,
				name,
				email,
				phone,
				position,
				department,
				address,
				notes,
			});
		}
	);
});

// Update worker
app.put("/api/workers/:id", (req, res) => {
	const workerId = req.params.id;
	const { name, email, phone, position, department, address, notes } =
		req.body;

	if (!name) {
		res.status(400).json({ error: "Name is required" });
		return;
	}

	db.query(
		`UPDATE workers SET name = ?, email = ?, phone = ?, position = ?, department = ?, address = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
		 WHERE id = ?`,
		[
			name,
			email || null,
			phone || null,
			position || null,
			department || null,
			address || null,
			notes || null,
			workerId,
		],
		function (err, result) {
			if (err) {
				if (err.code === "ER_DUP_ENTRY") {
					res.status(400).json({ error: "Email already exists" });
				} else {
					res.status(500).json({ error: err.message });
				}
				return;
			}
			if (result.affectedRows === 0) {
				res.status(404).json({ error: "Worker not found" });
				return;
			}
			res.json({ success: true });
		}
	);
});

// Delete worker
app.delete("/api/workers/:id", (req, res) => {
	const workerId = req.params.id;

	db.query(
		"DELETE FROM workers WHERE id = ?",
		[workerId],
		function (err, result) {
			if (err) {
				res.status(500).json({ error: err.message });
				return;
			}
			if (result.affectedRows === 0) {
				res.status(404).json({ error: "Worker not found" });
				return;
			}
			res.json({ success: true });
		}
	);
});

// Get departments for dropdown
app.get("/api/departments", (req, res) => {
	db.query(
		"SELECT DISTINCT department FROM workers WHERE department IS NOT NULL AND department != '' ORDER BY department",
		(err, results) => {
			if (err) {
				res.status(500).json({ error: err.message });
				return;
			}
			res.json(results.map((row) => row.department));
		}
	);
});

// Start server
app.listen(PORT, () => {
	console.log(`Kanban server running on port ${PORT}`);
	console.log(`Environment: ${NODE_ENV}`);
	if (NODE_ENV === "development") {
		console.log(`Visit: http://localhost:${PORT}`);
	}
});

// Graceful shutdown
process.on("SIGINT", () => {
	console.log("\nShutting down server...");
	db.end((err) => {
		if (err) {
			console.error(err.message);
		} else {
			console.log("Database connection closed.");
		}
		process.exit(0);
	});
});

process.on("SIGTERM", () => {
	console.log("SIGTERM received, shutting down gracefully");
	db.end((err) => {
		if (err) {
			console.error(err.message);
		} else {
			console.log("Database connection closed.");
		}
		process.exit(0);
	});
});
