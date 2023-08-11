module.exports = (search, auth, request, jsdom) => {
	return {
		getInstagramInfo: function (url) {
			return new Promise(resolve => {
				const { JSDOM } = jsdom
				request.get({
					url: url,
					headers: {
						'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.0',
						'From': 'webmaster@example.org'
					}
				}, async (err, response, body) => {
					if (!err) {
						try {
							const site = await new JSDOM(body, {
								runScripts: 'dangerously'
							})
							if (site.window.__initialData.data) {
								const instagram = await site.window.__initialData.data.entry_data.ProfilePage[0].graphql.user 
								if (instagram.edge_owner_to_timeline_media) {
									const { edge_owner_to_timeline_media } = instagram
									const { edges } = edge_owner_to_timeline_media
									if (edges.length) return resolve(edges[0])
								}
							}
							return resolve({})
						} catch (err) {
							return resolve({})
						}
					} else {
						return resolve({})
					}
				})
			})
		},
		getYoutubeLastVideo: (channelId) => {
			return new Promise((resolve, reject) => {
				search.list({
					auth,
					part: 'id,snippet',
					type: 'video',
					channelId: channelId,
					maxResults: 1,
					order: 'date'
				}, (err, response) => {
					if (err)	return reject({})

					const { items } = response.data
					if (items) {
						const video = items[0]
						if (video) {
							const lastVideo = {
								id: video.id.videoId,
								link: "https://www.youtube.com/watch?v=" + video.id.videoId,
								kind: video.id.kind,
								publishedAt: video.snippet.publishedAt,
								channelId: video.snippet.channelId,
								channelTitle: video.snippet.channelTitle,
								title: video.snippet.title,
								description: video.snippet.description,
								thumbnails: video.snippet.thumbnails
							}
							if (lastVideo.publishedAt) return resolve(lastVideo)
						}
					}
					resolve({})
				})
			})
		}
	}
}