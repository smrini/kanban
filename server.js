// Load environment variables
require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
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
    timezone: "local", // Use local timezone to prevent conversion
    dateStrings: true, // Return dates as strings instead of Date objects
    connectTimeout: 60000, // Connection timeout in milliseconds
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

	// Clients table - Create before cards table
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

	// Workers table - Create before cards table
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

	// Cards table - Create after clients and workers tables
	db.query(
		`
        CREATE TABLE IF NOT EXISTS cards (
            id INT AUTO_INCREMENT PRIMARY KEY,
            list_id INT,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            position INT NOT NULL,
            priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
            client_id INT,
            worker_id TEXT,
            head_equip_id INT,
            start_datetime DATETIME,
            vehicle_number VARCHAR(100),
            commands TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
            FOREIGN KEY (head_equip_id) REFERENCES workers(id) ON DELETE SET NULL
        )
    `,
		(err) => {
			if (err) console.error("Error creating cards table:", err);
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
								`SELECT c.*, 
									cl.name as client_name, cl.company as client_company,
									he.name as head_equip_name, he.position as head_equip_position
								FROM cards c
								LEFT JOIN clients cl ON c.client_id = cl.id
								LEFT JOIN workers he ON c.head_equip_id = he.id
								WHERE c.list_id = ? ORDER BY c.position`,
								[list.id],
								(err, cards) => {
									if (err) reject(err);
									else {
										// Process each card to handle worker_id array
										const processedCards = cards.map(
											(card) => {
												let workerIds = [];
												try {
													if (card.worker_id) {
														// Try to parse as JSON array, fallback to single ID
														if (
															card.worker_id.startsWith(
																"["
															)
														) {
															workerIds =
																JSON.parse(
																	card.worker_id
																);
														} else {
															workerIds = [
																parseInt(
																	card.worker_id
																),
															];
														}
													}
												} catch (e) {
													// If parsing fails, treat as single ID
													if (card.worker_id) {
														workerIds = [
															parseInt(
																card.worker_id
															),
														];
													}
												}

												const processedCard = {
													...card,
													worker_ids: workerIds,
												};

												return processedCard;
											}
										);

										resolve({
											...list,
											cards: processedCards,
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

app.post("/api/cards", (req, res) => {
	const {
		list_id,
		title,
		description,
		priority,
		client_id,
		worker_id,
		head_equip_id,
		start_datetime,
		vehicle_number,
		commands,
	} = req.body;

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

			// Handle start_datetime
			let formattedStartDatetime = null;
			if (start_datetime !== null && start_datetime !== undefined) {
				if (typeof start_datetime === "string") {
					if (start_datetime.trim() !== "") {
						// Simply convert T to space and ensure we have seconds
						let dateTimeStr = start_datetime.trim();
						if (dateTimeStr.includes("T")) {
							dateTimeStr = dateTimeStr.replace("T", " ");
						}
						// Add seconds if not present
						if (
							dateTimeStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
						) {
							dateTimeStr += ":00";
						}
						formattedStartDatetime = dateTimeStr;
					}
				} else {
					formattedStartDatetime = start_datetime;
				}
			}

			// Handle worker_id array - convert to JSON string if it's an array
			let processedWorkerId = worker_id;
			if (Array.isArray(worker_id)) {
				processedWorkerId = JSON.stringify(worker_id);
			}

			db.query(
				`INSERT INTO cards (
				list_id, title, description, position, priority,
				client_id, worker_id, head_equip_id, start_datetime, vehicle_number, commands
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					list_id,
					title,
					description || "",
					position,
					priority || "medium",
					client_id || null,
					processedWorkerId || null,
					head_equip_id || null,
					formattedStartDatetime,
					vehicle_number || null,
					commands || null,
				],
				function (err, result) {
					if (err) {
						console.error("Database error:", err);
						res.status(500).json({ error: err.message });
						return;
					}

					// Fetch the complete card with client and head equipment names
					const cardId = result.insertId;
					db.query(
						`SELECT c.*, 
							cl.name as client_name, cl.company as client_company,
							he.name as head_equip_name, he.position as head_equip_position
						FROM cards c
						LEFT JOIN clients cl ON c.client_id = cl.id
						LEFT JOIN workers he ON c.head_equip_id = he.id
						WHERE c.id = ?`,
						[cardId],
						(err, cardResults) => {
							if (err) {
								console.error(
									"Error fetching complete card data:",
									err
								);
								res.status(500).json({ error: err.message });
								return;
							}

							if (cardResults.length === 0) {
								res.status(404).json({
									error: "Card not found after creation",
								});
								return;
							}

							const completeCard = cardResults[0];

							// Process worker_id to worker_ids array (same logic as board retrieval)
							let workerIds = [];
							try {
								if (completeCard.worker_id) {
									// Try to parse as JSON array, fallback to single ID
									if (
										completeCard.worker_id.startsWith("[")
									) {
										workerIds = JSON.parse(
											completeCard.worker_id
										);
									} else {
										workerIds = [
											parseInt(completeCard.worker_id),
										];
									}
								}
							} catch (e) {
								// If parsing fails, treat as single ID
								if (completeCard.worker_id) {
									workerIds = [
										parseInt(completeCard.worker_id),
									];
								}
							}

							const responseData = {
								...completeCard,
								worker_ids: workerIds, // Add processed worker_ids array
							};

							res.json(responseData);
						}
					);
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
			client_id:
				updates.client_id !== undefined
					? updates.client_id
					: currentCard.client_id,
			worker_id:
				updates.worker_id !== undefined
					? updates.worker_id
					: currentCard.worker_id,
			head_equip_id:
				updates.head_equip_id !== undefined
					? updates.head_equip_id
					: currentCard.head_equip_id,
			start_datetime:
				updates.start_datetime !== undefined
					? updates.start_datetime
					: currentCard.start_datetime,
			vehicle_number:
				updates.vehicle_number !== undefined
					? updates.vehicle_number
					: currentCard.vehicle_number,
			commands:
				updates.commands !== undefined
					? updates.commands
					: currentCard.commands,
		};

		// Handle start_datetime
		let formattedStartDatetime = null;
		if (
			updatedData.start_datetime !== null &&
			updatedData.start_datetime !== undefined
		) {
			if (typeof updatedData.start_datetime === "string") {
				if (updatedData.start_datetime.trim() !== "") {
					// Simply convert T to space and ensure we have seconds
					let dateTimeStr = updatedData.start_datetime.trim();
					if (dateTimeStr.includes("T")) {
						dateTimeStr = dateTimeStr.replace("T", " ");
					}
					// Add seconds if not present
					if (dateTimeStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)) {
						dateTimeStr += ":00";
					}
					formattedStartDatetime = dateTimeStr;
				}
			} else {
				formattedStartDatetime = updatedData.start_datetime;
			}
		}

		// Handle worker_id array - convert to JSON string if it's an array
		let processedWorkerId = updatedData.worker_id;
		if (Array.isArray(updatedData.worker_id)) {
			processedWorkerId = JSON.stringify(updatedData.worker_id);
		}

		db.query(
			`UPDATE cards SET 
				title = ?, description = ?, priority = ?,
				client_id = ?, worker_id = ?, head_equip_id = ?, 
				start_datetime = ?, vehicle_number = ?, commands = ?
			WHERE id = ?`,
			[
				updatedData.title,
				updatedData.description || "",
				updatedData.priority || "medium",
				updatedData.client_id || null,
				processedWorkerId || null,
				updatedData.head_equip_id || null,
				formattedStartDatetime,
				updatedData.vehicle_number || null,
				updatedData.commands || null,
				cardId,
			],
			function (err) {
				if (err) {
					console.error("Error updating card:", err);
					res.status(500).json({ error: err.message });
					return;
				}
				res.json({
					success: true,
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

// Get clients for search (simplified) - MUST come before /:id route
app.get("/api/clients/search", (req, res) => {
	const { term } = req.query;
	let query = "SELECT id, name, company FROM clients";
	let params = [];

	if (term) {
		query += " WHERE name LIKE ? OR company LIKE ?";
		params = [`%${term}%`, `%${term}%`];
	}

	query += " ORDER BY name LIMIT 20";

	db.query(query, params, (err, results) => {
		if (err) {
			res.status(500).json({ error: err.message });
			return;
		}
		res.json(results || []);
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
			res.json({
				id: result.insertId,
				name,
				email,
				phone,
				company,
				client_id: clientId,
			});
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

// Get workers for search (simplified) - MUST come before /:id route
app.get("/api/workers/search", (req, res) => {
	const { term, role } = req.query;
	let query = "SELECT id, name, position FROM workers";
	let params = [];

	if (term) {
		query += " WHERE name LIKE ? OR position LIKE ?";
		params = [`%${term}%`, `%${term}%`];
	}

	if (role === "head_equip") {
		if (term) {
			query +=
				" AND position LIKE '%supervisor%' OR position LIKE '%manager%' OR position LIKE '%lead%' OR position LIKE '%head%'";
		} else {
			query +=
				" WHERE position LIKE '%supervisor%' OR position LIKE '%manager%' OR position LIKE '%lead%' OR position LIKE '%head%'";
		}
	}

	query += " ORDER BY name LIMIT 20";

	db.query(query, params, (err, results) => {
		if (err) {
			res.status(500).json({ error: err.message });
			return;
		}
		res.json(results || []);
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
		`UPDATE workers SET 
		 name = ?, email = ?, phone = ?, position = ?, 
		 department = ?, address = ?, notes = ?, 
		 updated_at = CURRENT_TIMESTAMP
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
		function (err) {
			if (err) {
				if (err.code === "ER_DUP_ENTRY") {
					res.status(400).json({ error: "Email already exists" });
				} else {
					res.status(500).json({ error: err.message });
				}
				return;
			}
			res.json({ success: true });
		}
	);
});

// Delete worker
app.delete("/api/workers/:id", (req, res) => {
	const workerId = req.params.id;

	db.query("DELETE FROM workers WHERE id = ?", [workerId], function (err) {
		if (err) {
			res.status(500).json({ error: err.message });
			return;
		}
		res.json({ success: true });
	});
});

// Get workers by IDs (for multiple worker selection)
app.post("/api/workers/by-ids", (req, res) => {
	const { workerIds, worker_ids } = req.body;
	const ids = workerIds || worker_ids; // Support both formats

	if (!ids || !Array.isArray(ids) || ids.length === 0) {
		res.json([]);
		return;
	}

	const placeholders = ids.map(() => "?").join(",");
	const query = `SELECT id, name, position FROM workers WHERE id IN (${placeholders})`;

	db.query(query, ids, (err, results) => {
		if (err) {
			console.error("Error fetching workers by IDs:", err);
			res.status(500).json({ error: err.message });
			return;
		}
		res.json(results);
	});
});

// Get unique departments for filtering
app.get("/api/departments", (req, res) => {
	db.query(
		"SELECT DISTINCT department FROM workers WHERE department IS NOT NULL AND department != '' ORDER BY department",
		(err, results) => {
			if (err) {
				console.error("Error fetching departments:", err);
				res.status(500).json({ error: err.message });
				return;
			}
			// Return array of department names
			const departments = results.map((row) => row.department);
			res.json(departments);
		}
	);
});

// Start server
const server = app.listen(PORT, () => {
	console.log(`Kanban server running on port ${PORT}`);
	console.log(`Environment: ${NODE_ENV}`);
	console.log(`Visit: http://localhost:${PORT}`);
});
