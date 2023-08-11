/**
 * Youtube Job
 * @author Diego Lamarão <diego@invasaonerd.com.br>
 */

 module.exports = (CronJob, cronTime, settings, mongodb, routinesreferencedb, http, mode, api) => {
	
	if (mode === 'prod') {
		new CronJob(cronTime.youtube, function () {

			youtubeJob(this, settings, mongodb, routinesreferencedb, http, mode, api)
			
		}, null, true, settings.timezone)
	}

	if (mode === 'dev') {
		youtubeJob(this, settings, mongodb, routinesreferencedb, http, mode, api)
	}
}


async function youtubeJob (context, settings, mongodb, routinesreferencedb, http, mode, api) {
	console.time('Youtube') 
	try {
		const channelCursor = routinesreferencedb.collection('channels')
		const channels = await channelCursor.find({}).toArray()

		var pages = await mongodb.collection('pages').find({
			$and: [{
				removed: { $ne: true }
			}, {
				'youtube.id': { $exists: true }
			}, {
				'youtube.url': { $exists: true }
			}]
		})
		.project({ youtube: true, url: true })
		.toArray()

		pages = pages.filter(({ youtube }) => {
			return youtube.statistics.videoCount > 0
		})

		const timer = (mode === 'prod' ? 3600000 : 60000) / pages.length

		if (channels.length === 0) {
			await popDatabase(channelCursor, pages, api, timer)
		} 
		else {
			const { success, fail } = await checkChanges(channelCursor, pages, http, settings, api, timer)
			console.log(`Finish Youtube Job with ${success} success and ${fail} fails`)
		}

		console.timeEnd('Youtube')

	} catch (err) {
		console.log(err)
		// enviar email para os admin
	}
	
}


async function popDatabase (channelCursor, pages, { getYoutubeLastVideo }, timer) {

	pages = await Promise.all(pages.map(({ youtube, url }, index) => {
		try {
			return new Promise(resolve => {
				setTimeout(async () => {
					const lastVideo = await getYoutubeLastVideo(youtube.id)
					resolve({
						id: url + '-' + youtube.id,
						url,
						lastVideoDate: lastVideo.publishedAt
					})
				}, timer * index)
			})
		} catch (err) {
			console.log(err)
			return null
		}
		
	}))
	try {
		await channelCursor.insertMany(pages.filter(item => item !== null && item.lastVideoDate))
		return true
	} catch (err) {
		console.log(err)
		channelCursor.drop()
		return false
	}
}


function checkChanges (channelCursor, pages, http, settings, { getYoutubeLastVideo }, timer) {

	return Promise.all(pages.map(async ({ youtube, url }, index) => {
		try {

			const localChannel = await channelCursor.findOne({ id: url + '-' + youtube.id })
			
			if (localChannel) {
				
				const lastVideo = await new Promise(async resolve => {

					setTimeout(async () => {
						try {
							resolve(await getYoutubeLastVideo(youtube.id))
						} catch (err) {
							console.log(err)
							resolve({})
						}
					}, timer * index)

				})

				var success = typeof lastVideo.publishedAt === 'string' && typeof localChannel.lastVideoDate === 'string'
				
				if (success) {

					if (lastVideo.publishedAt !== localChannel.lastVideoDate) {

						await http.post(settings.url + '/notify', { form: { url, type: 'youtube-video', payload: lastVideo } }, async function (error, response, body) {
							const { status } = JSON.parse(body)
							if (!error && status) {
								try {
									await channelCursor.updateOne({
										id: url + '-' + youtube.id
									}, {
										$set: { lastVideoDate: lastVideo.publishedAt }
									})
								} catch (err) {
									success = false
								}
							} else {
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
							const lastVideo = await getYoutubeLastVideo(youtube.id)
							if (typeof lastVideo.publishedAt === 'string') {
								await channelCursor.updateOne({
									id: url + '-' + youtube.id
								}, {
									$set: {
										id: url + '-' + youtube.id,
										url,
										lastVideoDate: lastVideo.publishedAt
									}
								}, {
									upsert: true
								})
								resolve(true)
							} else {
								resolve(false)
							}
						} catch (err) {
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
