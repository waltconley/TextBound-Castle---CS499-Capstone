// seed.ts

import * as fs from "node:fs";
import { parse } from "csv-parse/sync";
import { db } from "./index.ts";
import { levels } from "./schema.ts";
import type { InferInsertModel } from "drizzle-orm";

// This is the type we parse to w/ CSV parser
type CsvLevelRecord = {
  id: string;
  name: string;
  description: string;
  storyline: string;
  map_data: string;
  complete_msg?: string;
};

// Using this type for inserting into the database
type InsertLevel = InferInsertModel<typeof levels>;

async function seed() {
  console.log("🌱 Seeding database with levels from levels.csv...");

  try {
    // Reading the seed CSV
    const fileContent = fs.readFileSync("./db/fixed_levels.csv", {
      encoding: "utf-8",
    });

    // Parse the CSV data.
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
    }) as CsvLevelRecord[];

    console.log(`Found ${records.length} records in levels.csv`);

    // Process the records to parse the JSON string
    const parsedRecords = records.map((record) => {
      try {
        const mapData = JSON.parse(record.map_data);

        return {
          id: parseInt(record.id),
          name: record.name,
          description: record.description,
          storyline: record.storyline,
          complete_msg: record.complete_msg,
          mapData: mapData,
        };
      } catch (error) {
        console.error(
          `❌ Error parsing JSON for level "${record.name}":`,
          error,
        );
        return {
          id: parseInt(record.id),
          name: record.name,
          description: record.description,
          storyline: record.storyline,
          complete_msg: record.complete_msg,
          mapData: null,
        };
      }
    }) as InsertLevel[];

    await db.insert(levels).values(parsedRecords);

    console.log("✨ Seeding complete! Database is populated.");
  } catch (error) {
    console.error("❌ Error during seeding:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Execute the seeding function
seed();
