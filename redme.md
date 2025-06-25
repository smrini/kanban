# Kanban Board System

A full-featured Kanban board application built with Node.js backend and React frontend, featuring drag-and-drop functionality, calendar view, filtering, and dark/light theme support.

![Kanban Board](https://img.shields.io/badge/Status-Active-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![SQLite](https://img.shields.io/badge/Database-SQLite-blue)
![React](https://img.shields.io/badge/Frontend-React-61dafb)

## 🚀 Features

### Core Functionality
- **Drag & Drop**: Intuitive card and list reordering
- **Multiple Views**: Board view and Calendar view
- **Real-time Updates**: Live synchronization across views
- **Persistent Storage**: SQLite database for data persistence

### Card Management
- Create, edit, and delete cards
- Set priorities (Low, Medium, High, Urgent)
- Add due dates with overdue indicators
- Rich descriptions and metadata
- Visual priority indicators with color coding

### Advanced Features
- **Smart Filtering**: Search by text, filter by priority and due dates
- **Calendar Integration**: Drag cards between dates in calendar view
- **Theme Support**: Dark and light mode with smooth transitions
- **Responsive Design**: Works on desktop and mobile devices
- **Confirmation Dialogs**: Safety prompts for destructive actions

### User Experience
- **Keyboard Shortcuts**: ESC to cancel, Enter to confirm
- **Visual Feedback**: Hover effects, drag indicators, animations
- **Accessibility**: Focus management and screen reader support
- **Local Storage**: Remembers user preferences (theme, view, filters)

## 🛠️ Technologies Used

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web application framework
- **SQLite3** - Lightweight database
- **CORS** - Cross-origin resource sharing

### Frontend
- **React 18** - UI library (via CDN)
- **Babel Standalone** - JSX transformation
- **Font Awesome** - Icon library
- **CSS3** - Styling with CSS variables and animations

### Development Tools
- **Nodemon** - Development server with auto-restart
- **NPM** - Package management

## 📦 Installation

### Prerequisites
- Node.js 14.0.0 or higher
- NPM (comes with Node.js)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd kanban
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:3001`

### Production Setup

1. **Install dependencies**
   ```bash
   npm install --production
   ```

2. **Start the server**
   ```bash
   npm start
   ```

## 🎯 Usage Guide

### Getting Started

1. **Initial Setup**: The application creates a default board with "To Do", "In Progress", and "Done" lists
2. **Adding Cards**: Click "Add Card" in any list to create a new task
3. **Moving Cards**: Drag cards between lists or positions
4. **Editing**: Double-click list titles to rename, click cards to edit

### Board View Features

- **Drag & Drop**: Move cards within lists or between lists
- **List Management**: Add new lists, rename by double-clicking titles
- **Card Details**: View priority, due dates, and descriptions
- **Quick Actions**: Delete buttons with confirmation dialogs

### Calendar View Features

- **Date Navigation**: Use arrow buttons or "Go to Date" feature
- **Card Management**: Drag cards to different dates
- **Visual Indicators**: Today highlighting, overdue indicators
- **Quick Add**: Click on any date to add a task

### Filtering System

- **Text Search**: Search in card titles and descriptions
- **Priority Filter**: Filter by Low, Medium, High, or Urgent priority
- **Due Date Filter**: Show overdue, today, upcoming, or cards without dates
- **Filter Status**: Real-time count of filtered results

### Customization

- **Theme Toggle**: Switch between light and dark modes
- **View Persistence**: Your preferred view is remembered
- **Filter Persistence**: Filter visibility setting is saved

## 🗂️ Project Structure

```
kanban/
├── public/                 # Static files
│   ├── assets/
│   │   └── icons/         # Application icons
│   ├── css/
│   │   └── styles.css     # Main stylesheet
│   └── index.html         # Main HTML file
├── node_modules/          # Dependencies
├── server.js              # Express server
├── package.json           # Project configuration
├── kanban.db             # SQLite database (auto-created)
└── Docs.txt              # Development notes
```

## 🔧 API Endpoints

### Boards
- `GET /api/boards` - Get all boards
- `GET /api/boards/:id` - Get board with lists and cards
- `POST /api/boards` - Create new board

### Lists
- `POST /api/lists` - Create new list
- `PUT /api/lists/:id` - Update list title
- `PUT /api/lists/:id/reorder` - Reorder list position
- `DELETE /api/lists/:id` - Delete list

### Cards
- `POST /api/cards` - Create new card
- `PUT /api/cards/:id` - Update card details
- `PUT /api/cards/:id/move` - Move card position
- `DELETE /api/cards/:id` - Delete card

## 🎨 Customization

### Themes
The application supports custom themes through CSS variables. Modify the `:root` and `[data-theme="dark"]` selectors in [styles.css](public/css/styles.css) to customize colors.

### Adding Features
The modular React component structure makes it easy to add new features:
- Components are defined as functions in [index.html](public/index.html)
- API calls use the `fetch` API with the `API_BASE` constant
- State management uses React hooks

## 🔒 Database Schema

### Tables
- **boards**: `id`, `title`, `description`, `created_at`
- **lists**: `id`, `board_id`, `title`, `position`, `created_at`
- **cards**: `id`, `list_id`, `title`, `description`, `position`, `priority`, `due_date`, `created_at`

### Relationships
- Boards → Lists (One-to-Many)
- Lists → Cards (One-to-Many)
- Foreign key constraints with CASCADE DELETE

## 🚀 Performance Features

- **Efficient Drag & Drop**: Optimized position calculations
- **Smart Re-rendering**: React state management prevents unnecessary updates
- **Database Transactions**: Ensures data consistency during moves
- **Responsive Images**: Optimized icon loading
- **CSS Transitions**: Smooth animations without JavaScript

## 🐛 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Kill process on port 3001
   npx kill-port 3001
   ```

2. **Database Locked**
   - Restart the server
   - Check if another instance is running

3. **Cards Not Updating**
   - Check browser console for errors
   - Verify server is running

4. **Theme Not Switching**
   - Clear browser localStorage
   - Hard refresh (Ctrl+F5)

## 📝 Development Notes

### Completed Features ✅
- Enhanced form inputs with priority and due dates
- Double-click list title editing
- Modal forms with outside-click cancellation
- Calendar view implementation
- Font Awesome icons integration
- Drag and drop functionality
- Dark/Light mode toggle
- Advanced filtering system
- Draggable cards in calendar view
- Confirmation modals for destructive actions

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Font Awesome for the beautiful icons
- React team for the excellent library
- SQLite for the reliable database engine
- Express.js community for the robust framework

---

**Made with ❤️ by smrini**

For questions or support, please open an issue in the repository.