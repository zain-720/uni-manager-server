import express from "express";
import bodyParser from "body-parser";
import { dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import cors from "cors"; // To specifiy which url can make requests to the server
import dotenv from 'dotenv'

//const __dirname = dirname(fileURLToPath(import.meta.url)); //get path to curent folder 

const app = express(); 
const port = process.env.PORT || 3000; // Change to online server friendly port
dotenv.config({path: 'server/.env'})//access the .env file
dotenv.config() 

// 3000 localHost testport
// 443 HTTPS port, 80 HTTP port

// 
// https://uni-manager.vercel.app
const corsOptions = {origin: ['https://uni-manager-kgh8tj5ep-zains-projects-84ea1320.vercel.app', 'https://uni-manager.vercel.app'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}; //vite runs on 5173

//User inputs whatever their password is for their postgres

const db = new pg.Pool({
    connectionString: process.env.POSTGRES_URL
});
db.connect();

//const db = new pg.Client({
    //connectionString: process.env.POSTGRES_URL
//});

app.use(cors(corsOptions)); //requests now only accepted from vite server
app.use(bodyParser.json()); //parse incoming JSON bodies 
app.use(bodyParser.urlencoded({ extended: true })); //add body parser to the server
app.use(express.static("public"));

//Reasource lock to prevent race conditions when using NoteTaker, key is username, value is the date made
const noteLocks = new Map();

//Reasource lock to prevent race conditions when using TodoList, key is username, value is the date made
const todoLocks = new Map();

//Post request for attempting to set a lock for username
app.post('/acquireNoteLock', async (req, res) => {
    const { username } = req.body;
    
    // Check if this username already has a lock
    if (noteLocks.has(username)) {
        // If locked, reject the request
        res.status(423).json({ message: 'Resource locked' });
        return;
    }
    
    // If not locked, create a new lock
    noteLocks.set(username, Date.now());
    //console.log("acquired ", noteLocks);
    res.status(200).json({ message: 'Lock acquired' });
});

//Post request for attempting to release a lock for username
app.post('/releaseNoteLock', (req, res) => {
    const { username } = req.body;
    //console.log("released ", noteLocks);
    noteLocks.delete(username);
    
    res.json({ message: 'Lock released' });
});

//Post request for attempting to set a lock for username
app.post('/acquireTodoLock', async (req, res) => {
    const { username } = req.body;
    
    // Check if this username already has a lock
    if (todoLocks.has(username)) {
        // If locked, reject the request
        res.status(423).json({ message: 'Resource locked' });
        return;
    }
    
    // If not locked, create a new lock
    todoLocks.set(username, Date.now());
    //console.log("acquired ", todoLocks);
    res.status(200).json({ message: 'Lock acquired' });
});

//Post request for attempting to release a lock for username
app.post('/releaseTodoLock', (req, res) => {
    const { username } = req.body;
    //console.log("released ", todoLocks);
    todoLocks.delete(username);
    
    res.json({ message: 'Lock released' });
});



//Get request for finding if the user has entered valid credentials 
app.get('/requestLogin', async (req, res) => {  
    try{

        console.log("Connection ran as wanted good job");
        const { username , password } = req.query;
        const result = await db.query('SELECT * FROM login_data WHERE username = $1 AND password = $2', [username, password]);
        //retrun true or false depending on if user entered correctly or not
        
        if ((result.rows).length > 0) {
            //console.log('User found');
            res.json({output: true});
        } else {
            //console.log('No user found');
            res.json({output: false});
        } 
    }
    catch(err) {
        console.error(err)
    }
});

//Post request to try to create a new user 
app.post("/requestCreation", async (req, res) => {
    try{
        const { username, password } = req.body;

        // Check if the username already exists (do this to avoid an extra id being wasted)
        const checkUser = await db.query(
            'SELECT * FROM login_data WHERE username = $1',
            [username]
        );

        // If username is unqiue add the user if not return output of false
        if (checkUser.rows.length > 0) {
            res.json({output: false});
        }
        else{
            const result = await db.query("INSERT INTO login_data (username, password) VALUES ($1, $2) RETURNING *;", [username, password]);
            res.json({output: true});
        }
    }    
    catch(err){
        if(err.code === '23505'){
            console.error(err)
            //console.error("Same username attempted to add to the table")
        }
        else{
            console.error(err)
        }
    }
});

//Get request to try to get user notes data
app.get('/requestNoteData', async (req, res) => {  
    try{
        const { username } = req.query;
        const result = await db.query('SELECT * FROM note_data WHERE username = $1', [username]);

        //retrun the row containing the given users note data
        //console.log("note data ", result.rows[0]);
        res.json(result.rows[0]);
    }
    catch(err) {
        console.error(err)
    }
});

//PUT request to try to add a new note  
app.put("/requestAddNote", async (req, res) => {
    try{
        const { newData, username, newKeyValue } = req.body;
        //console.log("supposed to be enw data", newData);
        //console.log("supposed to be new" ,newKeyValue);
        const result = await db.query("UPDATE note_data SET notes = $1, key_number = $2 WHERE username = $3 RETURNING *;", [newData, newKeyValue, username]); 
        //console.log("done1");
        res.send('Complete'); // REMINDER : always send back a response 
    }    
    catch(err){
        console.error(err)   
    }
});

//PUT request to try to update an old note (ethier text update or deleting a note) 
app.put("/requestUpdateOrDeleteNote", async (req, res) => {
    try{
        const { newData, username } = req.body;
        //console.log("supposed to update", newData);
        const result = await db.query("UPDATE note_data SET notes = $1 WHERE username = $2 RETURNING *;", [newData, username]); 
        //console.log("done2");
        res.send('Complete2');
    }    
    catch(err){
        console.error(err)   
    }
});


//Get request to try to get user todo list data
app.get('/requestTodoListData', async (req, res) => {  
    try{
        const { username } = req.query;
        const result = await db.query('SELECT * FROM todolist_data WHERE username = $1', [username]);

        //retrun the row containing the given users note data
        //console.log("todo list data ", result.rows[0]);
        res.json(result.rows[0]);
    }
    catch(err) {
        console.error(err)
    }
});

//PUT request to try to update the todo items array 
app.put("/requestUpdateList", async (req, res) => {
    try{
        const { newData, username, nextKeyValue } = req.body;
        //console.log("supposed to be new data", newData);
        //console.log("supposed to be new" ,newKeyValue);
        const result = await db.query("UPDATE todolist_data SET items = $1, key_number = $2 WHERE username = $3 RETURNING *;", [newData, nextKeyValue, username]); 
        //console.log("done1");
        res.send('Complete'); // REMINDER : always send back a response 
    }    
    catch(err){
        console.error(err)   
    }
});


//Listen on Port3000
app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
  