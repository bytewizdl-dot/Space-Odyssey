const fs = require('fs');

function getPNGSize(filePath) {
    const buffer = fs.readFileSync(filePath);
    if (buffer.toString('ascii', 1, 4) !== 'PNG') {
        throw new Error('Not a PNG file');
    }
    const width = buffer.readInt32BE(16);
    const height = buffer.readInt32BE(20);
    return { width, height };
}

try {
    const size = getPNGSize('img/cockpit_family.png');
    console.log(`Dimensions: ${size.width}x${size.height}`);
} catch (e) {
    console.error(e.message);
}
