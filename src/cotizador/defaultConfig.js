// Valores del machote original (Machote_Horas-Días.xlsm). Se usan solo si la tabla de Supabase está vacía.
const DEFAULT_CFG = {
 "tc": 505,
 "cs": 0.4147,
 "fa": 0.125,
 "au": 0,
 "margin": 0.3,
 "matMargin": 0.2,
 "rend": {
  "tub": 20,
  "disp": 15,
  "hDia": 10,
  "dSem": 5
 },
 "roles": [
  {
   "id": "rmv771fpb165o",
   "name": "Jefatura IPM",
   "sal": 850000
  },
  {
   "id": "rmv771fpb21ix",
   "name": "Jefatura Proyectos",
   "sal": 950000
  },
  {
   "id": "rmv771fpb34on",
   "name": "Operario Rafael Vindas",
   "sal": 750000
  },
  {
   "id": "rmv771fpb46x0",
   "name": "Técnico Senior",
   "sal": 690000
  },
  {
   "id": "rmv771fpb53ou",
   "name": "Operario Senior",
   "sal": 560000
  },
  {
   "id": "rmv771fpb673a",
   "name": "Ayudante Senior",
   "sal": 440000
  },
  {
   "id": "rmv771fpb7gs",
   "name": "Ayudante Junior",
   "sal": 420000
  },
  {
   "id": "rmv771fpb87lj",
   "name": "Tecnico Junior",
   "sal": 490000
  },
  {
   "id": "rmv771fpb953y",
   "name": "Ayudante Semi Junior",
   "sal": 490000
  },
  {
   "id": "rmv771fpbaj5",
   "name": "Ayudante Senior (2)",
   "sal": 420000
  },
  {
   "id": "rmv771fpbb699",
   "name": "Tecnico Semi Senior",
   "sal": 570000
  },
  {
   "id": "rmv771fpbc50l",
   "name": "Supervisor",
   "sal": 730000
  },
  {
   "id": "rmv771fpbd5aw",
   "name": "Salud Ocupacional",
   "sal": 560000
  }
 ],
 "cr": [
  {
   "id": "crmv771fpce4wc",
   "n": "Hospedaje",
   "um": "Nch",
   "pu": 120,
   "noW": true
  },
  {
   "id": "crmv771fpcf3wt",
   "n": "Alimentación",
   "um": "Dia",
   "pu": 25
  },
  {
   "id": "crmv771fpcg1z5",
   "n": "Carro",
   "um": "km",
   "pu": 1
  },
  {
   "id": "crmv771fpch5h9",
   "n": "Alquiler Auto",
   "um": "Dia",
   "pu": 70
  },
  {
   "id": "crmv771fpci3c2",
   "n": "Celular",
   "um": "Gbl",
   "pu": 10
  },
  {
   "id": "crmv771fpcj1ne",
   "n": "Combustible",
   "um": "Gbl",
   "pu": 30
  },
  {
   "id": "crmv771fpck3ry",
   "n": "Otros: Parqueo",
   "um": "Gbl",
   "pu": 1
  },
  {
   "id": "crmv771fpcl1iv",
   "n": "Extra",
   "um": "Gbl",
   "pu": 1
  }
 ],
 "ca": [
  {
   "id": "camv771fpcm5g0",
   "n": "Hospedaje",
   "um": "Nch",
   "pu": 0
  },
  {
   "id": "camv771fpcn5j4",
   "n": "Alimentación",
   "um": "Dia",
   "pu": 18
  },
  {
   "id": "camv771fpco689",
   "n": "Alquiler Auto",
   "um": "Km",
   "pu": 0
  },
  {
   "id": "camv771fpcp7iv",
   "n": "Avion",
   "um": "Gbl",
   "pu": 300
  },
  {
   "id": "camv771fpcq34a",
   "n": "Celular",
   "um": "Gbl",
   "pu": 30
  }
 ],
 "renta": [
  {
   "id": "rentamv771fpcr1s7",
   "n": "Boom",
   "um": "Sem",
   "pu": 1400
  },
  {
   "id": "rentamv771fpcs10r",
   "n": "Boom",
   "um": "Gbl",
   "pu": 500
  },
  {
   "id": "rentamv771fpct477",
   "n": "Transporte de Equipos",
   "um": "Gbl",
   "pu": 500
  },
  {
   "id": "rentamv771fpcu7ks",
   "n": "Transporte de Materiales",
   "um": "Gbl",
   "pu": 500
  },
  {
   "id": "rentamv771fpcv1kj",
   "n": "Cursos",
   "um": "Gbl",
   "pu": 300
  },
  {
   "id": "rentamv771fpcw3wn",
   "n": "Ambiente EHS Cajones",
   "um": "Gbl",
   "pu": 1000
  },
  {
   "id": "rentamv771fpcx6ok",
   "n": "Polizas",
   "um": "Gbl",
   "pu": 250
  }
 ],
 "mats": [
  {
   "id": "mmv771fpcyq3",
   "n": "Tubo EMT 3/4\" USA (3m)",
   "um": "Pipe",
   "list": 7
  },
  {
   "id": "mmv771fpcz77p",
   "n": "conector para biex",
   "um": "Pipe",
   "list": 0.75
  },
  {
   "id": "mmv771fpc106dh",
   "n": "Conector EMT presión 3/4\" USA",
   "um": "Ea",
   "list": 0.12069
  },
  {
   "id": "mmv771fpc112v1",
   "n": "Conector EMT presión 1/2\" USA",
   "um": "Ea",
   "list": 0.310345
  },
  {
   "id": "mmv771fpc1235b",
   "n": "Gaza EMT 3/4\" USA",
   "um": "Ea",
   "list": 0.06
  },
  {
   "id": "mmv771fpc13gj",
   "n": "Gaza EMT 1/2\" USA",
   "um": "Ea",
   "list": 0.027586
  },
  {
   "id": "mmv771fpc1458h",
   "n": "Unión EMT presión 3/4\" USA",
   "um": "Ea",
   "list": 0.55
  },
  {
   "id": "mmv771fpc154zx",
   "n": "Unión EMT presión 1/2\" USA",
   "um": "Ea",
   "list": 0.353448
  },
  {
   "id": "mmv771fpc165jh",
   "n": "Riel strut perfil alto 1-5/8 x 1-5/8 pulgadas x 3 m",
   "um": "Ea",
   "list": 11
  },
  {
   "id": "mmv771fpc174so",
   "n": "Caja octogonal",
   "um": "Ea",
   "list": 0.310345
  },
  {
   "id": "mmv771fpc18xs",
   "n": "Caja cuadrada, con tapa",
   "um": "Ea",
   "list": 1.78
  },
  {
   "id": "mmv771fpc196af",
   "n": "Caja rectangular",
   "um": "Ea",
   "list": 0.267241
  },
  {
   "id": "mmv771fpc1a2cl",
   "n": "Cinta",
   "um": "Ea",
   "list": 2400
  },
  {
   "id": "mmv771fpc1b1fa",
   "n": "Biex explosion proof",
   "um": "ud",
   "list": 560
  },
  {
   "id": "mmv771fpc1c3r2",
   "n": "tubo para vesda (4m)",
   "um": "pipe",
   "list": 13.6
  },
  {
   "id": "mmv771fpc1d5qe",
   "n": "Cable Shield #18 /2 (Carrucha de 1000')",
   "um": "ml",
   "list": 0.44
  },
  {
   "id": "mmv771fpc1e4yi",
   "n": "Cable Shield #18 /4 (Carrucha de 1000')",
   "um": "ml",
   "list": 0.632
  },
  {
   "id": "mmv771fpc1f9q",
   "n": "Cable Shield #16 /2 (Carrucha de 1000')",
   "um": "ml",
   "list": 0.504
  },
  {
   "id": "mmv771fpc1g2c5",
   "n": "Cable sin Shield #18 /2 (Carrucha de 1000')",
   "um": "ml",
   "list": 0.296
  },
  {
   "id": "mmv771fpc1h3jk",
   "n": "Biex (30)",
   "um": "ml",
   "list": 1.504
  },
  {
   "id": "mmv771fpc1i63x",
   "n": "Cable sin Shield #18 /2 (Carrucha de 305m)",
   "um": "unidad",
   "list": 128.54
  },
  {
   "id": "mmv771fpc1j39z",
   "n": "Cable sin Shield #16 /2 (Carrucha de 305m)",
   "um": "unidad",
   "list": 150
  },
  {
   "id": "mmv771fpc1k61u",
   "n": "Cable intemperie (carrucha cable)",
   "um": "",
   "list": 0.416
  },
  {
   "id": "mmv771fpc1l2k8",
   "n": "Cable subterraneo 4x18",
   "um": "",
   "list": 513
  },
  {
   "id": "mmv771fpc1m6u0",
   "n": "Coonduit PVC…. 1574 colones c/u",
   "um": "",
   "list": 0.13
  }
 ]
};
export default DEFAULT_CFG;
