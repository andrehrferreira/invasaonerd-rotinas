/**
 * Server
 * @author Diego Lamarão <diego@invasaonerd.com.br>
 */

const { load } = require("organized")
 
load({
	cron: 'cron',
	http: 'request',
	db: 'mongodb',
	googleapis: 'googleapis',
	jsdom: 'jsdom',
	settings: './config.js',
	api: (googleapis, jsdom, http) => {
		
		const { search } = googleapis.google.youtube('v3')
		const auth = ''

		return require('./apis')(search, auth, http, jsdom)
	},
	mode: () => {
		return process.env.NODE_ENV || "dev"
	},
	MongoClient: (db) => {
		return db.MongoClient
	},
	CronJob: (cron) => {
		return cron.CronJob
	},
	cronTime: (mode) => {
		return {
			prod: {
				youtube: '0 0 */1 * * *',
				instagram: '0 */30 * * * *'
			},
			stg: {
				youtube: '0 0 */1 * * *',
				instagram: '0 */30 * * * *'
			},
			dev: {
				youtube: '*/5 * * * * *',
				instagram: '*/5 * * * * *'
			}
		}[mode]
	}
}, {
	provider: (_this) => {
	},
	services: [(_this, settings, MongoClient) => {

		MongoClient.connect(settings.invasaodb.url, { useNewUrlParser: true }, (err, client) => {

			if (err) console.error("MongoDB", "Error to start: " + err)
			else console.log("MongoDB", "Connection on " + settings.invasaodb.url)
			const db = client.db(settings.invasaodb.database)
			_this.set("mongodb", db)

		})

		MongoClient.connect(settings.routinesreferencedb.url, { useNewUrlParser: true }, (err, client) => {

			if (err) console.error("MongoDB", "Error to start: " + err)
			else console.log("MongoDB", "Connection on " + settings.routinesreferencedb.url)
			const db = client.db(settings.routinesreferencedb.database)
			_this.set("routinesreferencedb", db)

		})

	}],
	map: [`${__dirname}/src/*.js`],
	scope: (_this) => {
		console.log('-------------------- Cron Server --------------------')
	}
}, { require: require })