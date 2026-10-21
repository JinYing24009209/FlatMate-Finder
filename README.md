# FlatMate Finder

FlatMate Finder is a full-stack student accommodation and flatmate-matching platform. It brings room listings, flatmate discovery, enquiries, notifications, moderation and AI-assisted features into one system.

The application supports three main roles:

- **Students** can search for rooms or flatmates, save results, communicate with other users and follow updates.
- **Advertisers** can create and manage room listings, answer enquiries and review demonstration payment outcomes.
- **Administrators** can manage users, listings, reports, staff access and platform categories.

The project uses React, Vite and Tailwind CSS for the frontend, Node.js and Express for the REST API, PostgreSQL for persistent data, and the Gemini API for optional AI assistance. 

## 1. Project structure

```text
FlatMate-Finder/
|-- backend/
|   |-- server.js                 # Express application entry point
|   |-- src/
|   |   |-- config/               # PostgreSQL connection settings
|   |   |-- middleware/           # Authentication, authorisation and error handling
|   |   |-- routes/               # REST endpoints grouped by feature
|   |   `-- services/             # Validation, notifications and AI business logic
|   |-- scripts/                  # Database migration and maintenance scripts
|   `-- test/                     # Backend unit and integration tests
|-- frontend/
|   |-- public/                   # Static public files
|   |-- src/
|   |   |-- components/           # Reusable interface components
|   |   |-- hooks/                # Shared React hooks
|   |   |-- pages/                # Role-based application screens
|   |   |-- services/             # Frontend API client
|   |   |-- styles/               # Global and feature styles
|   |   `-- utils/                # Frontend helper functions
|   `-- test/                     # Frontend interaction tests
|-- database/
|   |-- schema.sql                # Base PostgreSQL schema
|   |-- upgrade.sql               # Core non-destructive upgrades
|   `-- *-upgrade.sql             # Feature-specific migrations
|-- shared/
|   |-- nzCities.json             # Shared New Zealand city options
|   `-- nzSuburbs.json            # Suburbs grouped by city
|-- render.yaml                   # Render deployment configuration
`-- README.md
```

### Main data flow

1. React stores the current form and page state.
2. The frontend API client sends requests to the Express REST API.
3. Middleware verifies the signed-in user, active account and permitted role.
4. Route and service modules validate the request and run parameterised PostgreSQL queries.
5. The API returns JSON, and React updates the page without a full reload.


## 2. Environment and running the project

### Prerequisites

- Node.js `20.19.0` or later, or Node.js `22.12.0` or later
- npm
- An internet connection for the existing Neon database and Gemini API

### 2.1 Install dependencies

Open a terminal in the project directory and install the backend and frontend packages:

```powershell
cd backend
npm install

cd ..\frontend
npm install
```

### 2.2 Use the supplied environment

The repository includes `backend/.env`. It already contains the connection settings for the team's existing Neon database, the backend authentication settings and the Gemini configuration.

### 2.3 Use the existing cloud database

The supplied environment connects directly to the team's existing Neon PostgreSQL database. The schema and current migrations have already been applied.

### 2.4 Start the application

Start the backend in the first terminal:

```powershell
cd backend
npm run dev
```

Start the frontend in a second terminal:

```powershell
cd frontend
npm run dev
```

Open `http://localhost:5173`. During local development, Vite forwards `/api` requests to `http://localhost:5000`.


## 3. Team responsibilities

| Member | Student ID | Main responsibilities |
| --- | --- | --- |
| **Pengrui Su** | 24009388 | Project background and objectives; registration and login; standard flatmate search and saved profiles; flatmate conversations and mutual agreement; AI flatmate recommendations; software testing. |
| **Xinze Gao** | 24009030 | Requirements analysis; system architecture; user profiles; saved listings; report, user and category management; AI listing recommendations. |
| **Ying Jin** | 24009209 | Home page; room search; notifications; AI smart search; shared AI client and error handling; software quality evaluation. |
| **Xiangxiao Li** | 24009017 | Listing creation and management; housing enquiries; demonstration payments; AI listing summaries; user guidance and deployment. |
| **Xinrui Gao** | 24009024 | Database design; dashboards and administrator statistics; AI safety support; development iterations and problems; conclusion and future work. |


## 4. What we learned

### Pengrui Su

Taking charge of the account and flatmate-related features gave me a great chance to put database knowledge into practice. For example, a composite UNIQUE constraint prevents duplicate saves and duplicate conversations. A CHECKconstraint stops users from saving themselves, and CASE WHEN ensures users can only update their own agreement status. Besides, database transactions guarantee that account creation and invite code consumption stay consistent.In addition, working on AI recommendations and testing practices helped me grasp the general workflows and logic behind calling external AI services and running automated tests. 

The chat feature really helped me understand race conditions. When using async/await, asynchronous requests might return out of order. An earlier request could still finish later and end up incorrectly updating another conversation. Therefore, it’s necessary to check whether a request is still valid and to clean up old polling tasks when leaving the page. This gave me a much more concrete understanding of React Effects and Promises.

### Xinze Gao

Working on these features changed how I judge whether a function is complete. I used to focus on whether the page showed the expected result. I now also check what remains in the database after a user changes their mind, whether a failed update leaves an incorrect notification, and what happens when two administrators review the same report. The profile forms showed me that updating information sometimes means removing an earlier value. Selecting Flexible must clear the saved move-in date, otherwise matching still uses a preference the student has withdrawn. Saved-room alerts helped me understand why related writes belong in one transaction: the listing change and its notification must both succeed, or neither should be saved. Moderation made the difference between locking and checking clearer. A row lock makes the second administrator wait, but the status check is what stops their decision from replacing an existing review. AI recommendations also taught me to look beyond whether an API call succeeds. A response can arrive but still contain an invalid candidate index or score. Checking each entry and retaining its local result lets the application handle a partly usable response.

### Ying Jin

Working on the home page, room search, notifications and AI smart search helped me understand how the frontend, backend and database work together. For standard search, I learned how React form values become URL query parameters, how Express checks them, and how PostgreSQL applies them to the listing query. I also realised that user experience is more important than page layout. For example, search conditions should remain when a student opens a listing and returns to the results. And the AI work was more challenging. Gemini could return missing or invalid message, and API requests could fail or reach a rate limit. This taught me that model output cannot be trusted directly, and the backend must validate the result and keep control of the SQL query. Building notifications also helped me understand how the same service can support different roles while keeping each user’s messages separate. In a future project, I would test failed API calls and complete user journeys earlier instead of waiting until the final testing stage.

### Xiangxiao Li

I learned that publishing a room takes more than filling in a form. The server also needs to check that the listing details are valid and that the advertiser has permission to change them. In the chat feature, I found that an older request can finish after the user has opened another conversation. The page needs to ignore that response, or it could show messages from the wrong conversation. I also learned that the server must check the room’s availability again before saving a demo payment, because its status may have changed during checkout. I also worked on the AI listing summary feature, including how it sends listing details to Gemini, handles the returned summary and uses a local summary when Gemini cannot provide a usable result. Writing the setup instructions helped me understand how to start the frontend and backend and connect them to the database. Overall, these tasks helped me see how the features I worked on fit into the website and depend on each other.

### Xinrui Gao

This project shifted my focus from just implementing features to ensuring system robustness.During the database design, I realized that deletion rules must depend on business needs. To prevent the loss of financial history, I implemented a JSONB snapshot for payments, so the transaction record remains complete even if the listing is removed.Building the admin dashboard taught me the importance of strict data definitions. Visualizing data is straightforward, but if the backend SQL counts mock test payments as actual outcomes, the dashboard misleads administrators. I learned to verify the query logic before relying on the charts. Managing three distinct user layouts within one React component also strengthened my frontend architecture skills.For the AI safety feature, I found that external models cannot be fully trusted. To handle potential AI failures or missed detections, I combined the AI output with local rule-based checks. Taking the highest risk score between them ensures the safety feature remains reliable. 

Ultimately, I learned that keeping a system reliable is about having a backup plan for every risk. Whether it was preserving deleted records or handling AI failures, those fallbacks are what truly made the platform stable.


## Repository

GitHub: [JinYing24009209/FlatMate-Finder](https://github.com/JinYing24009209/FlatMate-Finder)
