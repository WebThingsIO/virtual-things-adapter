#!/bin/bash -e

rm -rf node_modules

npm install --production

# Remove internal package-lock cache which can cause checksum errors at runtime
rm -f node_modules/.package-lock.json

shasum --algorithm 256 manifest.json package.json *.js LICENSE > SHA256SUMS
find static -type f -exec shasum --algorithm 256 {} \; >> SHA256SUMS

find node_modules \( -type f -o -type l \) -exec shasum --algorithm 256 {} \; >> SHA256SUMS

TARFILE=`npm pack`

tar xzf ${TARFILE}
cp -r node_modules ./package
tar czf ${TARFILE} package

shasum --algorithm 256 ${TARFILE} > ${TARFILE}.sha256sum

rm -rf SHA256SUMS package
