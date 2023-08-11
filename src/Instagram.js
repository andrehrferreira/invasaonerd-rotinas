/**
 * Instagram Job
 * @author Diego Lamarão <diego@invasaonerd.com.br>
 */

module.exports = (CronJob, cronTime, settings, mongodb, routinesreferencedb, http, mode, api) => {
	
	if (mode === 'prod') {
		new CronJob(cronTime.instagram, function () {

			instagramJob(this, settings, mongodb, routinesreferencedb, http, mode, api)
			
		}, null, true, settings.timezone)
	}

	if (mode === 'dev') {
		instagramJob(this, settings, mongodb, routinesreferencedb, http, mode, api)
	}

}

async function instagramJob (context, settings, mongodb, routinesreferencedb, http, mode, api) {
 console.time('Instagram')
 
	try {

		const instagramsCursor = routinesreferencedb.collection('instagrams')
		const instagrams = await instagramsCursor.find({}).toArray()

		const pages = filteredPages(await mongodb.collection('pages').find({
			$and: [{
				removed: { $ne: true }
			}, {
				"instagram.url": { $exists: true }
			}, {
				"instagram.url": { $ne: null }
			}]
		})
		.project({ instagram: true, url: true })
		.toArray())

		const timer = (mode === 'prod' ? 1800000 : 60000) / pages.length

		if (instagrams.length === 0) {
			await popDatabase(instagramsCursor, pages, api, timer)
		} else {
			const { success, fail } = await checkChanges(instagramsCursor, pages, http, settings, api, timer)
			console.log(`Finish instagram Job with ${success} success and ${fail} fails`)
		}

	} catch (err) {
		console.log('ERROR: ', err)
	}

	// // IF DEV OR STG MODE STOP
	// if (mode === 'dev' || mode === 'stg') context.stop()

 console.timeEnd('Instagram')
}

function filteredPages(list) {
	return list.map(page => {
		if (
				!page.instagram.url ||
				page.instagram.url.includes('/p/')  ||
				page.instagram.url.includes('/explore/') ||
				page.instagram.url.includes('/tags/')
			) {
			page.toRemove = true
		}
		return page
	}).filter(({ toRemove, url }) => {
		return !toRemove
	})
}

function checkChanges (instagramsCursor, pages, http, settings, { getInstagramInfo }, timer) {

	return Promise.all(pages.map(async ({ instagram, url }, index) => {
		try {
			const localMedia = await instagramsCursor.findOne({ id: url + '-' + instagram.url })
			
			if (localMedia) {
				
				const lastMidia = await new Promise(async resolve => {

					setTimeout(async () => {
						try {
							resolve(await getInstagramInfo(instagram.url))
						} catch (err) {
							console.log(err)
							resolve({})
						}
					}, timer * index)

				})
				const { node } = lastMidia
				var success = node !== undefined
				
				if (success) {

					if (localMedia.timestamp !== node.taken_at_timestamp) {

						await http.post(settings.url + '/notify', { form: { url, type: 'instagram', payload: node } }, async function (error, response, body) {
							try {
								const { status } = JSON.parse(body)
								if (!error && status) {
									instagramsCursor.updateOne({
										id: url + '-' + instagram.url
									}, {
										$set: { timestamp: node.taken_at_timestamp }
									})
								} else {
									success = false
								}
							} catch (err) {
								success = false
							}
						})
					}
				}
				
				return success
			} else {
				return await new Promise(resolve => {

					setTimeout(async () => {
						try {
							const lastMidia = await getInstagramInfo(instagram.url)
							const { node } = lastMidia
							if (node) {
								await instagramsCursor.updateOne({
									id: url + '-' + instagram.url
								}, {
									$set: {
										id: url + '-' + instagram.url,
										url,
										timestamp: node.taken_at_timestamp
									}
								}, {
									upsert: true
								})
								resolve(true)
							} else {
								resolve(false)
							}
						} catch (err) {
							console.log(err)
							resolve(false)
						}					
					}, timer * index)

				})
			}
		} catch (err) {
			console.log(err)
			return false
		}
	}))
	.then(results => {
		return results.reduce((acc, item) => {
			if (item) acc.success += 1
			else acc.fail += 1
			return acc
		}, { success: 0, fail: 0 })
	})
}

async function popDatabase (instagramsCursor, pages, { getInstagramInfo }, timer) {

	pages = await Promise.all(pages.map(({ instagram, url }, index) => {
		try {
			return new Promise(resolve => {
				setTimeout(async () => {
					const lastMidia = await getInstagramInfo(instagram.url)
					const { node } = lastMidia
					if (node) {
						resolve({
							id: url + '-' + instagram.url,
							url,
							timestamp: node.taken_at_timestamp
						})
					} else {
						resolve(null)
					}					
				}, timer * index)
			})
		} catch (err) {
			console.log(err)
			return null
		}
	}))
	try {
		await instagramsCursor.insertMany(pages.filter(item => item))
		return true
	} catch (err) {
		console.log(err)
		instagramsCursor.drop()
		return false
	}	
}
