import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    // 1. Recibimos los datos enviados desde tu frontend
    const nuevoAtaque = await request.json();
    
    // Obtenemos el nombre del algoritmo (ej: "AES", "MD5", "RSA", "SHA-256")
    // Lo convertimos a mayúsculas para que coincida exactamente con las llaves de tu JSON
    const algoritmo = nuevoAtaque.algoritmo?.toUpperCase(); 

    if (!algoritmo) {
      return NextResponse.json({ error: 'Falta especificar el algoritmo' }, { status: 400 });
    }

    // 2. Ruta física a tu attacks.json
    const filePath = path.join(process.cwd(), 'app', 'data', 'attacks.json');

    // 3. Leemos el archivo
    const fileContents = await fs.readFile(filePath, 'utf8');
    let dataJSON = JSON.parse(fileContents);

    // 4. Navegamos inteligentemente por la estructura de tu JSON
    // Si el algoritmo (ej: "AES") no existe aún en el JSON, creamos su estructura base
    if (!dataJSON[algoritmo]) {
      dataJSON[algoritmo] = {
        summary: { total_files: 1, total_records: 0 },
        datasets: [{ data: [] }]
      };
    }

    // Ubicamos el primer dataset de ese algoritmo
    let targetDataset = dataJSON[algoritmo].datasets[0];
    
    // Nos aseguramos de que exista el arreglo "data" donde van los registros
    if (!targetDataset.data || !Array.isArray(targetDataset.data)) {
      targetDataset.data = [];
    }

    // 5. ¡Agregamos el nuevo ataque al arreglo!
    targetDataset.data.push(nuevoAtaque);

    // (Opcional) Actualizamos el contador de total_records en el summary
    if (dataJSON[algoritmo].summary && typeof dataJSON[algoritmo].summary.total_records === 'number') {
      dataJSON[algoritmo].summary.total_records += 1;
    }

    // 6. Sobreescribimos el archivo físico
    await fs.writeFile(filePath, JSON.stringify(dataJSON, null, 4), 'utf8');

    return NextResponse.json({ message: `Ataque guardado exitosamente en la sección ${algoritmo}` }, { status: 200 });

  } catch (error) {
    console.error("Error al escribir en attacks.json:", error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}