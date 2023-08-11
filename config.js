/**
 * Settings
 * @author Diego Lamarão <diego@invasaonerd.com.br>
 */

let mode = process.env.NODE_ENV || "dev";

module.exports = {
	dev: {
		production: false,
		invasaodb: {
			url: "mongodb://127.0.0.1:27017/skynet",
			database: "skynet"
		},
		routinesreferencedb: {
			url: "mongodb://127.0.0.1:27017/routines",
			database: "routines"
		},
		timezone: "America/Sao_Paulo",
		url: "http://localhost:8555"
	},
	stg: {
		production: false,
		invasaodb: {
			url: "mongodb://10.136.162.95:27017/skynetStaging",
			database: "skynetStaging"
		},
		routinesreferencedb: {
			url: "mongodb://10.136.162.95:27017/routinesStaging",
			database: "routinesStaging"
		},
		timezone: "America/Sao_Paulo",
		url: "https://stg.invasaonerd.com.br"
	},
	prod: {
		production: true,
		invasaodb: {
			url: "mongodb://10.136.162.95:27017/skynet",
			database: "skynet"
		},
		routinesreferencedb: {
			url: "mongodb://10.136.162.95:27017/routines",
			database: "routines"
		},
		timezone: "America/Sao_Paulo",
		url: "https://invasaonerd.com.br"
	}
}[mode]