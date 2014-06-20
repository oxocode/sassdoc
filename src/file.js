var fs     = require('fs');
var rimraf = require('rimraf');
var swig   = require('swig');
var Q      = require('q');
var parser = require('./parser');

exports = module.exports = {

  /**
   * Folder API
   */
  folder: {
    /**
     * @see {@link http://nodejs.org/api/fs.html#fs_fs_readdir_path_callback}
     * @see {@link https://github.com/kriskowal/q/wiki/API-Reference#interfacing-with-nodejs-callbacks}
     */
    read: Q.denodeify(fs.readdir),

    /**
     * @see {@link http://nodejs.org/api/fs.html#fs_fs_mkdir_path_mode_callback}
     * @see {@link https://github.com/kriskowal/q/wiki/API-Reference#interfacing-with-nodejs-callbacks}
     */
    create: Q.denodeify(fs.mkdir),
    
    /**
     * @see {@link https://github.com/isaacs/rimraf}
     * @see {@link https://github.com/kriskowal/q/wiki/API-Reference#interfacing-with-nodejs-callbacks}
     */
    remove: Q.denodeify(rimraf),
    
    /**
     * Remove then create a folder
     * @param  {String} folder
     * @return {Q.Promise}
     */
    refresh: function (folder) {
      return exports.folder.remove(folder).then(function() {
        return exports.folder.create(folder);
      }, function () {
        return exports.folder.create(folder);
      });
    },

    /**
     * Parse a folder
     * @param  {String} folder
     * @param  {String} destination
     * @return {Q.Promise}
     */
    parse: function (folder, destination) {
      return exports.folder.read(folder).then(function (files) {
        var promises = [];

        files.forEach(function (file) {
          var path = folder + '/' + file;

          if (exports.isDirectory(path)) {
            promises.concat(exports.folder.parse(path, destination));
          }

          else {
            promises.push(exports.file.process(folder, destination, file));
          }
        });

        return Q.all(promises);

      }, function (err) {
        console.log(err);
      });
    }
  },

  /**
   * File API
   */
  file: {
    /**
     * @see {@link http://nodejs.org/api/fs.html#fs_fs_readfile_filename_options_callback}
     * @see {@link https://github.com/kriskowal/q/wiki/API-Reference#interfacing-with-nodejs-callbacks}
     */
    read: Q.denodeify(fs.readFile),

    /**
     * @see {@link http://nodejs.org/api/fs.html#fs_fs_writefile_filename_data_options_callback}
     * @see {@link https://github.com/kriskowal/q/wiki/API-Reference#interfacing-with-nodejs-callbacks}
     */
    create: Q.denodeify(fs.writeFile),

    /**
     * @see {@link http://nodejs.org/api/fs.html#fs_fs_unlink_path_callback}
     * @see {@link https://github.com/kriskowal/q/wiki/API-Reference#interfacing-with-nodejs-callbacks}
     */
    remove: Q.denodeify(fs.unlink),

    /**
     * Process a file
     * @param  {String} file
     * @param  {String} destination
     * @return {Q.Promise}
     */
    process: function (source, destination, file) {
      return exports.file.read(source + '/' + file, 'utf-8').then(function (data) {
        return exports.file.generate(destination + '/' + file.replace('.scss', '.html'), exports.file.parse(data));
      });
    },

    /**
     * Generate a file with swig
     * @param  {String} destination
     * @param  {Array} data
     * @return {Q.Promise}
     */
    generate: function (destination, data) {
      var template = swig.compileFile(__dirname + '/../assets/templates/file.html.swig');

      return exports.file.create(destination, template({
        data: data,
        title: destination
      }));
    },

    /**
     * Copy a file
     * @param  {String} source
     * @param  {String} destination
     * @return {Q.Promise}
     */
    copy: function (source, destination) {
      return fs.createReadStream(source).pipe(fs.createWriteStream(destination));
    },

    /**
     * Parse a file
     * @return {Array}
     */
    parse: parser.parseFile
  },

  /**
   * Test if path is a directory
   * @param  {String}  path
   * @return {Boolean}
   */
  isDirectory: function (path) {
    return fs.lstatSync(path).isDirectory();
  },

  /**
   * Build index
   * @param  {String} destination
   * @return {Q.Promise}
   */
  buildIndex: function (destination) {
    return exports.folder.read(destination).then(function (files) {
      var _files = [];

      for (var i = 0; i < files.length; i++) {
        if (files[i].charAt(0) !== '.' && !exports.isDirectory(destination + '/' + files[i])) {
          _files.push(files[i]);
        }
      }

      var template = swig.compileFile(__dirname + '/../assets/templates/index.html.swig');

      return exports.file.create(destination + '/index.html', template({ files: _files }));
    }, function (err) {
      console.log(err);
    });
  },

  /**
   * Dump CSS
   * @param  {String} destination
   * @return {Q.Promise}
   */
  dumpAssets: function (destination) {
    destination = __dirname + '/../' + destination + '/css';

    return exports.folder.create(destination).then(function () {
      return exports.file.copy(__dirname + '/../assets/css/styles.css', destination + '/styles.css')
    });
  }

}