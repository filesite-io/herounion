/**
 * Main program of Hero Union of filesite.io
 **/

import express from 'express';
import bodyParser from 'body-parser';
import apiRouter from './router_api.mjs';

const app = express();

//Express behind proxies
app.set('trust proxy', true);
app.disable('x-powered-by');

//Serving static files
app.use(express.static('public'));

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ limit: '10mb', extended: false }))
// parse application/json
app.use(bodyParser.json({ limit: '10mb' }))

app.use('/api', apiRouter);

/*
app.get('/', (req, res) => {
    return res.send('Welcome to Hero Union of filesite.io');
});

app.post('/test', (req, res) => {
    console.log('Post data got in /test', req.body);

    return res.status(200).send('Done');
});
*/

//error handler
app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    console.error('Request error in hero union: %s', err.stack);

    var statusCode = 500;
    if (typeof(err.statusCode) != 'undefined' && err.statusCode) {
        statusCode = err.statusCode;
    }
    return res.status(statusCode).send(err.message);
})

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, async () => {
    console.log('Server listening on port %s:%s...', HOST, PORT);
});
