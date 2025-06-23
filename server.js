const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/fontawesome', express.static(path.join(__dirname, 'node_modules/@fortawesome/fontawesome-free')));

// Initialize SQLite database
const db = new sqlite3.Database('./kanban.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  // Boards table
  db.run(`
    CREATE TABLE IF NOT EXISTS boards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Lists table
  db.run(`
    CREATE TABLE IF NOT EXISTS lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER,
      title TEXT NOT NULL,
      position INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE
    )
  `);

  // Cards table
  db.run(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      position INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (list_id) REFERENCES lists (id) ON DELETE CASCADE
    )
  `);

  // Create default board and lists if they don't exist
  db.get("SELECT COUNT(*) as count FROM boards", (err, row) => {
    if (row.count === 0) {
      createDefaultData();
    }
  });
}

function createDefaultData() {
  db.run("INSERT INTO boards (title, description) VALUES (?, ?)", 
    ["KanBan Board", "Welcome to your Kanban board!"], 
    function(err) {
      if (err) return console.error(err);
      
      const boardId = this.lastID;
      const defaultLists = [
        { title: "To Do", position: 0 },
        { title: "In Progress", position: 1 },
        { title: "Done", position: 2 }
      ];

      defaultLists.forEach(list => {
        db.run("INSERT INTO lists (board_id, title, position) VALUES (?, ?, ?)",
          [boardId, list.title, list.position]);
      });
    });
}

// API Routes

// Get all boards
app.get('/api/boards', (req, res) => {
  db.all("SELECT * FROM boards ORDER BY created_at DESC", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get board with lists and cards
app.get('/api/boards/:id', (req, res) => {
  const boardId = req.params.id;
  
  // Get board info
  db.get("SELECT * FROM boards WHERE id = ?", [boardId], (err, board) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!board) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }

    // Get lists for this board
    db.all("SELECT * FROM lists WHERE board_id = ? ORDER BY position", [boardId], (err, lists) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      // Get cards for each list
      const listPromises = lists.map(list => {
        return new Promise((resolve, reject) => {
          db.all("SELECT * FROM cards WHERE list_id = ? ORDER BY position", [list.id], (err, cards) => {
            if (err) reject(err);
            else resolve({ ...list, cards });
          });
        });
      });

      Promise.all(listPromises)
        .then(listsWithCards => {
          res.json({ ...board, lists: listsWithCards });
        })
        .catch(err => {
          res.status(500).json({ error: err.message });
        });
    });
  });
});

// Create new board
app.post('/api/boards', (req, res) => {
  const { title, description } = req.body;
  db.run("INSERT INTO boards (title, description) VALUES (?, ?)", 
    [title, description || ''], 
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, title, description });
    });
});

// Create new list
app.post('/api/lists', (req, res) => {
  const { board_id, title } = req.body;
  
  // Get the next position
  db.get("SELECT MAX(position) as maxPos FROM lists WHERE board_id = ?", [board_id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const position = (row.maxPos || -1) + 1;
    
    db.run("INSERT INTO lists (board_id, title, position) VALUES (?, ?, ?)",
      [board_id, title, position],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ id: this.lastID, board_id, title, position, cards: [] });
      });
  });
});

// Create new card
app.post('/api/cards', (req, res) => {
  const { list_id, title, description } = req.body;
  
  // Get the next position
  db.get("SELECT MAX(position) as maxPos FROM cards WHERE list_id = ?", [list_id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const position = (row.maxPos || -1) + 1;
    
    db.run("INSERT INTO cards (list_id, title, description, position) VALUES (?, ?, ?, ?)",
      [list_id, title, description || '', position],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ 
          id: this.lastID, 
          list_id, 
          title, 
          description: description || '', 
          position 
        });
      });
  });
});

// Update card position (for drag and drop)
app.put('/api/cards/:id/move', (req, res) => {
  const cardId = req.params.id;
  const { list_id, position } = req.body;
  
  // Start a transaction to handle position updates
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    
    // Get current card info
    db.get("SELECT * FROM cards WHERE id = ?", [cardId], (err, currentCard) => {
      if (err) {
        db.run("ROLLBACK");
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (!currentCard) {
        db.run("ROLLBACK");
        res.status(404).json({ error: 'Card not found' });
        return;
      }
      
      // If moving to the same list, adjust positions
      if (currentCard.list_id === list_id) {
        // Moving within the same list
        if (position > currentCard.position) {
          // Moving down: decrease position of cards between old and new position
          db.run(
            "UPDATE cards SET position = position - 1 WHERE list_id = ? AND position > ? AND position <= ?",
            [list_id, currentCard.position, position],
            (err) => {
              if (err) {
                db.run("ROLLBACK");
                res.status(500).json({ error: err.message });
                return;
              }
              updateCardPosition();
            }
          );
        } else if (position < currentCard.position) {
          // Moving up: increase position of cards between new and old position
          db.run(
            "UPDATE cards SET position = position + 1 WHERE list_id = ? AND position >= ? AND position < ?",
            [list_id, position, currentCard.position],
            (err) => {
              if (err) {
                db.run("ROLLBACK");
                res.status(500).json({ error: err.message });
                return;
              }
              updateCardPosition();
            }
          );
        } else {
          // Same position, no change needed
          db.run("COMMIT");
          res.json({ success: true });
          return;
        }
      } else {
        // Moving to different list
        // First, decrease positions in the old list
        db.run(
          "UPDATE cards SET position = position - 1 WHERE list_id = ? AND position > ?",
          [currentCard.list_id, currentCard.position],
          (err) => {
            if (err) {
              db.run("ROLLBACK");
              res.status(500).json({ error: err.message });
              return;
            }
            
            // Then, increase positions in the new list
            db.run(
              "UPDATE cards SET position = position + 1 WHERE list_id = ? AND position >= ?",
              [list_id, position],
              (err) => {
                if (err) {
                  db.run("ROLLBACK");
                  res.status(500).json({ error: err.message });
                  return;
                }
                updateCardPosition();
              }
            );
          }
        );
      }
      
      function updateCardPosition() {
        // Finally, update the moved card
        db.run(
          "UPDATE cards SET list_id = ?, position = ? WHERE id = ?",
          [list_id, position, cardId],
          function(err) {
            if (err) {
              db.run("ROLLBACK");
              res.status(500).json({ error: err.message });
              return;
            }
            db.run("COMMIT");
            res.json({ success: true });
          }
        );
      }
    });
  });
});

// Update card
app.put('/api/cards/:id', (req, res) => {
  const cardId = req.params.id;
  const { title, description } = req.body;
  
  db.run("UPDATE cards SET title = ?, description = ? WHERE id = ?",
    [title, description || '', cardId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true });
    });
});

// Delete card
app.delete('/api/cards/:id', (req, res) => {
  const cardId = req.params.id;
  
  db.run("DELETE FROM cards WHERE id = ?", [cardId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true });
  });
});

// Delete list
app.delete('/api/lists/:id', (req, res) => {
  const listId = req.params.id;
  
  db.run("DELETE FROM lists WHERE id = ?", [listId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Kanban server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  db.close((err) => {
    if (err) {
      console.error(err.message);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});