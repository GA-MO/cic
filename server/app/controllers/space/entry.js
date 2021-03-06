const mongoose = require('mongoose');
const _ = require('lodash');

const Entry = require('../../models/Entry');
const Space = require('../../models/Space');
const _helper = require('./helper');

/**
 * Entries
 */
exports.getAllEntries = (req, res, next) => {
  const spaceId = req.params.space_id;
  Space.findOne({ _id: spaceId }).populate('entries').exec((err, space) => {
    if (err) { return next(err); }
    res.json({
      items: space.entries,
    });
  });
};

exports.getSingleEntry = (req, res, next) => {
  const entryId = req.params.entry_id;
  Entry.findOne({ _id: entryId }, (err, entry) => {
    if (err) { return next(err); }
    res.json({
      item: entry,
    });
  });
}

// UPDATE CONTENT TYPE
const updateEntry = (req, res, next) => {
  const spaceId = req.params.space_id;
  const entryId = req.params.entry_id;
  const contentTypeId = req.headers['x-cic-content-type'];
  const fields = req.body.fields;
  const status = req.body.status;
  console.log('updateEntry', fields);

  Space.findOne({ _id: spaceId }, (err, space) => {
    if (err) { return next(err); }

    // Check contentType
    const contentTypeInfo = _.find(space.contentTypes, ct => ct._id.equals(contentTypeId));

    if (!contentTypeInfo) {
      res.json({
        status: 'UNSUCCESSFUL',
        detail: `Invalid contentType ${contentTypeId}`,
      });
      return;
    }

    const isExistingInSpace = _.find(space.entries, entry => entry.equals(entryId));
    if (isExistingInSpace) {

      const validation = _helper.validateFields(fields, contentTypeInfo);
      if (!validation.valid) {
        res.json({
          status: 'UNSUCCESSFUL',
          message: validation.message,
        });
        return;
      }

      // Not update spaces.entry
      // Update entry
      Entry.findOne({ _id: entryId }, (err, entry) => {
        entry.fields = fields;
        entry.status = status;
        entry.save((err1) => {
          if (err1) return _helper.handleError(err1, next);
          res.json({
            status: 'SUCCESS',
            detail: 'Updating entry successfully',
            entry,
          });
        });
      });
    } else {
      // 1. Create and Insert new entry
      // 2. Update spaces.entry
      const newEntry = new Entry({
        contentTypeId,
        fields,
        status: 'draft',
        _spaceId: spaceId,
      });

      newEntry.save((err) => {
        if (err) return _helper.handleError(err, next);

        // Update space
        space.entries.push(newEntry._id);
        space.save((err2) => {
          if (err2) { return next(err2); }
          res.json({
            status: 'SUCCESS',
            detail: 'Create new entry successfully',
            entry: newEntry,
          });
        });
      });
    }
  });
};

exports.updateEntry = updateEntry;

// CREATE CONTENT TYPE
exports.createEntry = (req, res, next) => {
  // Create new objectId
  const entryId = mongoose.Types.ObjectId();
  req.params.entry_id = entryId;
  return updateEntry(req, res, next);
};

exports.deleteEntry = (req, res, next) => {
  const spaceId = req.params.space_id;
  const entryId = req.params.entry_id;
  Entry.remove({ _id: entryId }, (err) => {
    if (err) return _helper.handleError(err, next);

    // Remove entry ref from space
    Space.findOne({ _id: spaceId }, (err, space) => {
      if (err) return _helper.handleError(err, next);
      space.entries = _.filter(space.entries, _id => !_id.equals(entryId));

      space.save((err2) => {
        if (err2) return _helper.handleError(err2, next);
        res.json({
          status: 'SUCCESS',
          detail: 'delete entry successfully',
        });
      });
    });
  });
};

exports.truncateEntry = (req, res, next) => {
  const spaceId = req.params.space_id;
  Space.findOne({ _id: spaceId }, (err, space) => {
    if (err) { return next(err); }
    space.entries = [];
    space.save((err) => {
      if (err) return _helper.handleError(err, next);

      Entry.remove({ _spaceId: spaceId }, (err2) => {
        if (err2) return _helper.handleError(err2, next);
        res.json({
          status: 'SUCCESS',
          detail: 'clear all entries in space successfully',
          space,
        });
      });
    });
  });
};
