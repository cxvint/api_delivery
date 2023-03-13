const { readFileSync } = require('fs');
const { createServer } = require('http');
const path = require('path');

const DB_FILE = process.env.DB_FILE || path.resolve(__dirname, 'db.json');
const CATEGORY_FILE =
	process.env.DB_FILE || path.resolve(__dirname, 'category.json');
const PORT = process.env.PORT || 3024;
const URI_PREFIX = '/api/product';

class ApiError extends Error {
	constructor(statusCode, data) {
		super();
		this.statusCode = statusCode;
		this.data = data;
	}
}

function getGoodsList(params = {}) {
	const goods = JSON.parse(readFileSync(DB_FILE) || '[]');

	let data = goods;

	if (params.category) {
		const category = params.category.trim().toLowerCase();
		const regExp = new RegExp(`^${category}$`);
		data = data.filter((item) => regExp.test(item.category.toLowerCase()));
	}

	if (params.list) {
		const list = params.list.split(',');
		data = data.filter((item) => list.includes(item.id));
	}

	if (params.list === '') {
		return [];
	}

	return data;
}

function getItems(itemId) {
	const goods = JSON.parse(readFileSync(DB_FILE) || '[]');
	const item = goods.find(({ id }) => id === itemId);
	if (!item) throw new ApiError(404, { message: 'Item Not Found' });
	return item;
}

function getCategory() {
	const category = JSON.parse(readFileSync(CATEGORY_FILE) || '[]');
	return category;
}

module.exports = server = createServer(async (req, res) => {
	if (req.url.substring(1, 4) === 'img') {
		res.statusCode = 200;
		res.setHeader('Content-Type', 'image/jpeg');
		require('fs').readFile(`.${req.url}`, (err, image) => {
			res.end(image);
		});
		return;
	}

	res.setHeader('Content-Type', 'application/json');

	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

	if (req.method === 'OPTIONS') {
		res.end();
		return;
	}

	if (!req.url || !req.url.startsWith(URI_PREFIX)) {
		res.statusCode = 404;
		res.end(JSON.stringify({ message: 'Not Found' }));
		return;
	}
	const [uri, query] = req.url.substr(URI_PREFIX.length).split('?');
	const queryParams = {};

	if (query) {
		for (const piece of query.split('&')) {
			const [key, value] = piece.split('=');
			queryParams[key] = value ? decodeURIComponent(value) : '';
		}
	}

	try {
		const body = await (async () => {
			if (uri === '' || uri === '/') {
				// /api/goods
				if (req.method === 'GET') return getGoodsList(queryParams);
			} else if (req.url.endsWith('category')) {
				if (req.method === 'GET') return getCategory();
			} else {
				// /api/goods/{id}
				const itemId = uri.substr(1);
				if (req.method === 'GET') return getItems(itemId);
			}
			return null;
		})();
		res.end(JSON.stringify(body));
	} catch (err) {
		console.log('err: ', err);
		if (err instanceof ApiError) {
			res.writeHead(err.statusCode);
			res.end(JSON.stringify(err.data));
		} else {
			res.statusCode = 500;
			res.end(JSON.stringify({ message: 'Server Error' }));
		}
	}
})
	.on('listening', () => {
		if (process.env.NODE_ENV !== 'test') {
			console.log(`Сервер запущен. http://localhost:${PORT}`);
		}
	})
	.listen(PORT);
