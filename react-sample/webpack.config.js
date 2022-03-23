module.exports = {
    // Required to fix the following error:
    // Module not found: Error: Can't resolve 'util' in '/sampleapp/node_modules/aws-sdk/lib'
    // Reference: https://github.com/aws/aws-sdk-js/issues/3501
    resolve: {
      fallback: { 
        "util": require.resolve("util/"),
      },
    }
  }