const db = require('../db')

function getOrCreateMoshpit () {
  const normalized = normalizeBoardName(boardName)
  const existing = db
    .prepare(
      `
        SELECT *
        FROM moshpits
        WHERE unique_id = ?
    `
    )
    .get(normalized)

  if (existing) {
    return existing
  }

  try {
    const result = db
      .prepare(
        `
            INSERT INTO moshpits (
                unique_id
            )
            VALUES (?)
        `
      )
      .run(normalized)

    return db
      .prepare(
        `
            SELECT *
            FROM moshpits
            WHERE id = ?
        `
      )
      .get(result.lastInsertRowid)
  } catch (error) {
    // Another request may have created it simultaneously.
    return db
      .prepare(
        `
            SELECT *
            FROM moshpits
            WHERE unique_id = ?
        `
      )
      .get(normalized)
  }
}

function disableMoshpit () {}

function hideMoshpit () {}

function freezeMoshpit () {}

function silenceMoshpit () {}

function slowmodeMoshpit () {}
