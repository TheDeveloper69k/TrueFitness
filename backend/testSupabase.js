const supabase = require("./src/config/supabaseClient");

async function test() {
  try {
    const { data, error } = await supabase.from("trainers").select("*");
    console.log("DATA:", data);
    console.log("ERROR:", error);
  } catch (err) {
    console.error("CAUGHT ERROR:", err);
    if (err.cause) {
      console.error("CAUSE:", err.cause);
    }
  }
}

test();