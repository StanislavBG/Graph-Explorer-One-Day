# Graph Explorer - Data Relationship Visualization

An interactive web application for visualizing and analyzing data relationships using graph theory concepts. Built with Next.js, React, and Tailwind CSS.

## 🌐 Live Demo

**Access the application:** [https://stanislavbg.github.io/Graph-Explorer-One-Day/](https://stanislavbg.github.io/Graph-Explorer-One-Day/)

## 🚀 Features

- **Interactive Graph Visualization**: Circular layout with nodes representing data records
- **Relationship Analysis**: Edges show positive (green) and negative (red) relationships between records
- **Match Rules Engine**: Hierarchical rule system for evaluating data relationships
- **Real-time Interaction**: Hover and click on nodes/edges for detailed information
- **Responsive Design**: Works on desktop and mobile devices
- **Data Table View**: Tabular representation of all records below the graph

## 🎯 Use Cases

- **Data Deduplication**: Identify potential duplicate records
- **Data Quality Analysis**: Find inconsistencies in datasets
- **Relationship Mapping**: Visualize connections between different data entities
- **Business Intelligence**: Analyze customer or product relationships

## 🛠️ Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Data Processing**: Custom match rules engine
- **Deployment**: GitHub Pages with static export

## 📊 Data Structure

The application processes records with the following fields:
- Record ID, UUID, Salutation, First Name, Middle Name, Last Name, Email, Phone

## 🔧 Local Development

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Setup
```bash
# Clone the repository
git clone https://github.com/StanislavBG/Graph-Explorer-One-Day.git
cd Graph-Explorer-One-Day

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

### Build for Production
```bash
# Build for GitHub Pages
npm run build:gh-pages

# Build for standard deployment
npm run build
```

## 📋 Match Rules

The application uses a hierarchical rule system:

- **Rule-1**: Compares salutation, firstName, lastName, email
- **Rule-2**: Compares salutation, firstName, lastName, phone  
- **Rule-3**: Compares salutation, firstName, lastName, addressLine1, city, country
- **Rule-4-7**: Nested rules for more specific comparisons

## 🚀 Deployment

This project is automatically deployed to GitHub Pages using GitHub Actions. Every push to the main branch triggers a new deployment.

## 👥 For Colleagues

**To access the application:**
1. Visit: [https://stanislavbg.github.io/Graph-Explorer-One-Day/](https://stanislavbg.github.io/Graph-Explorer-One-Day/)
2. No login required - it's a public application
3. Works in any modern web browser
4. Mobile-friendly interface

**Key Features for Data Analysis:**
- Hover over nodes to see record details
- Click on edges to understand relationship rules
- Use the left panel to see statistics and unified profiles
- Check the right panel for detailed match information

## 📝 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Feel free to submit issues, feature requests, or pull requests to improve the application.

---

**Built with ❤️ using Next.js and React** 