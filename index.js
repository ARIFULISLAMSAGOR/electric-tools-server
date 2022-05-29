const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { ObjectID } = require('bson');
const port = process.env.PORT || 5000;
const app = express();
const stripe = require('stripe')('sk_test_51L4OOwFE4wv54inCqK8DfIw2xxWOeyvFq78u3x2vbKPCH6ZW9mOKQDdrRqOjfDTCHbSqLhuAamcoOFnin5SgVjzp00IbQkyV9I')

//middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zrpd3.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized Access' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        await client.connect()
        const productCollection = client.db('electrictools').collection('product');
        const bookingCollection = client.db('electrictools').collection('booking');
        const userCollection = client.db("electrictools").collection("users");
        const reviewCollection = client.db("electrictools").collection("reviews");
        const paymentCollection = client.db("electrictools").collection("payments");

        app.get('/product', async (req, res) => {
            const query = {};
            const cursor = productCollection.find(query);
            const products = await cursor.toArray();
            res.send(products);
        });

        app.get('/booking', verifyJWT, async (req, res) => {
            const coustomar = req.query.coustomar;
            const decodedEmail = req.decoded.email;
            if (coustomar) {
                const query = { coustomar: coustomar };
                const bookings = await bookingCollection.find(query).toArray();
                return res.send(bookings);
            }
            else {
                return res.status(403).send({ message: 'forbidden access' })
            }

        })

        app.get('/booking/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            console.log(id)
            const query = { _id: ObjectId(id) };
            const booking = await bookingCollection.findOne(query);
            res.send(booking);
        })


        app.post('/booking', async (req, res) => {
            const order = req.body;
            const result = await bookingCollection.insertOne(order);
            res.json(result);
        });
        app.get("/bookingP/:email", async (req, res) => {
            console.log(req.params.email);
            const result = await bookingCollection.find({ coustomar: req.params.email })
                .toArray();
            res.json(result);
        });


        app.patch('/paymentBooking/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updatedBooking = await bookingCollection.updateOne(filter, updatedDoc);
            const result = await paymentCollection.insertOne(payment);
            res.send(updatedDoc)
        });


        app.post("/create-payment-intent", async (req, res) => {
            const paymentInfo = req.body;
            const amount = paymentInfo.price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                currency: "usd",
                amount: amount,
                payment_method_types: ["card"],
            });
            res.json({ clientSecret: paymentIntent.client_secret });
        });

        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        });

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        });

        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'forbidden' })
            }
        });

        app.post("/addService", async (req, res) => {
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.json(result);
        });

        app.delete('/booking/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectID(id) };
            const result = await productCollection.deleteOne(query);
            res.send(result);
        })

        app.post("/reviews", async (req, res) => {
            const review = req.body;
            console.log(review);
            const result = await reviewCollection.insertOne(review);
            res.json(result);
        });

        //Get All reviews
        app.get("/reviews", async (req, res) => {
            const cursor = reviewCollection.find({});
            const reviews = await cursor.toArray();
            res.json(reviews);
        });


        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET)
            res.send({ result, token });
        })
    }
    finally {

    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('electric tools running')
})
app.listen(port, () => {
    console.log('electric tools running port', port)
})

