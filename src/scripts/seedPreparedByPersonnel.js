const dotenv = require("dotenv");
dotenv.config();

const mongoose = require("mongoose");
const Personnel = require("../models/Personnel");
const connectDB = require("../utils/db");

const preparedBySeed = [
  {
    name: "Alma Lacerna",
    email: "almalacserna@laverdad.edu.ph",
    department: "Office of the Administrator",
    position: "Secretary to the Administrator",
  },
  {
    name: "Annabelle Bencosio",
    email: "annabellebencas@laverdad.edu.ph",
    department: "Higher Education",
    position: "BSSW - Program Head",
  },
  {
    name: "Anne Beverly Soriano",
    email: "annebeverlysoriano@laverdad.edu.ph",
    department: "Registrar and Admissions",
    position: "Department Head",
  },
  {
    name: "Christine Angeli Adova",
    email: "angeladova@laverdad.edu.ph",
    department: "Compliance",
    position: "Compliance Officer",
  },
  {
    name: "Daisy Cruz",
    email: "daisycruz@laverdad.edu.ph",
    department: "Quality Assurance",
    position: "Quality Assurance Officer",
  },
  {
    name: "Elyness Asuncion Belendres",
    email: "elynassasuncion@laverdad.edu.ph",
    department: "Communications",
    position: "Department Head",
  },
  {
    name: "Eric Bolano",
    email: "ericbolano@laverdad.edu.ph",
    department: "General Services and Security",
    position: "Department Head",
  },
  {
    name: "Eric Yumul",
    email: "ericyumul@laverdad.edu.ph",
    department: "Higher Education",
    position: "BSA/BSAIS - Program Head",
  },
  {
    name: "Irish Joye Domiao",
    email: "irishdomioa@laverdad.edu.ph",
    department: "Basic Education",
    position: "Assistant Principal (Primary Department)",
  },
  {
    name: "Ireagan Domolo Jr",
    email: "iregandonolor@laverdad.edu.ph",
    department: "Management Information System",
    position: "Department Head",
  },
  {
    name: "Ivy Mae Garcia",
    email: "ivymaegarcia@laverdad.edu.ph",
    department: "Human Resource",
    position: "Department Head",
  },
  {
    name: "Jade Riel Abuela",
    email: "jaderiel.abu@laverdad.edu.ph",
    department: "Office of the Chancellor",
    position: "Secretary to the Chancellor",
  },
  {
    name: "Jasmin Yoon",
    email: "jasimyoon@laverdad.edu.ph",
    department: "Library",
    position: "Department Head",
  },
  {
    name: "Jeremy Damlao",
    email: "jeremydamlao@laverdad.edu.ph",
    department: "Data Privacy",
    position: "Compliance Officer",
  },
  {
    name: "Jerreck Reynold Navalta",
    email: "jerreckreynoldnavalta@laverdad.edu.ph",
    department: "Higher Education",
    position: "BSIB/ACT - Program Head",
  },
  {
    name: "Joel Regino",
    email: "joelregino@laverdad.edu.ph",
    department: "Higher Education",
    position: "BAB - Program Head",
  },
  {
    name: "Lucka Kristine Villanueva",
    email: "luckievillanueva@laverdad.edu.ph",
    department: "Prefect of Student Affairs and Services",
    position: "Department Head",
  },
  {
    name: "Raquel Blaza",
    email: "raquelblaza@laverdad.edu.ph",
    department: "Finance and Accounting",
    position: "Department Head",
  },
  {
    name: "Roldan Villanueva",
    email: "roldanvillanueva@laverdad.edu.ph",
    department: "Basic Education",
    position: "Assistant Principal (Senior Department)",
  },
  {
    name: "Rommel Alba",
    email: "rommelalba@laverdad.edu.ph",
    department: "Basic Education",
    position: "Assistant Principal (Academic Affairs)",
  },
  {
    name: "Ruperto Gibon Jr",
    email: "rupertogibon@laverdad.edu.ph",
    department: "Basic Education",
    position: "Assistant Principal (Homeschool Department)",
  },
  {
    name: "Shanece Labung",
    email: "shanecelabung@laverdad.edu.ph",
    department: "Data Privacy and Office of the Chancellor / Administrator",
    position: "Chancellor/Administrator/Assistant Principal",
  },
  {
    name: "Sheila De Guzman",
    email: "sheiladeguzman@laverdad.edu.ph",
    department: "Basic Education",
    position: "Assistant Principal (Junior Department)",
  },
  {
    name: "Tito Motocfinos",
    email: "titomotosfinos@laverdad.edu.ph",
    department: "Basic Education",
    position: "Assistant Principal (Intermediate Department)",
  },
  {
    name: "Willen Anne Alba",
    email: "willenanneelba@laverdad.edu.ph",
    department: "Prefect of Student Affairs and Services",
    position: "Assistant Department Head",
  },
];

async function seed() {
  try {
    await connectDB();

    const existing = await Personnel.find({}).select("email");
    const existingEmails = new Set(existing.map((p) => p.email.toLowerCase()));

    const toInsert = preparedBySeed
      .filter((p) => !existingEmails.has(p.email.toLowerCase()))
      .map((p) => ({
        ...p,
        isActive: true,
      }));

    if (toInsert.length === 0) {
      console.log("No new personnel to insert. Already seeded.");
    } else {
      await Personnel.insertMany(toInsert);
      console.log(`Inserted ${toInsert.length} personnel records.`);
    }
  } catch (error) {
    console.error("Seeding error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
