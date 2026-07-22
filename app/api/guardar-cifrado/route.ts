import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const nuevoCifrado = await request.json();

    // ¡Ojo aquí! Apuntamos específicamente a algorithms.json
    const filePath = path.join(process.cwd(), 'app', 'data', 'algorithms.json');

    const fileContents = await fs.readFile(filePath, 'utf8');
    let dataJSON = JSON.parse(fileContents);

    // Por la estructura que me pasaste antes de algorithms.json, 
    // la información de los cifrados se guarda en un arreglo general llamado "data"
    if (dataJSON.data && Array.isArray(dataJSON.data)) {
        dataJSON.data.push(nuevoCifrado);
    } else {
        // Si no existe, lo creamos
        dataJSON.data = [nuevoCifrado];
    }

    await fs.writeFile(filePath, JSON.stringify(dataJSON, null, 4), 'utf8');

    return NextResponse.json({ message: 'Cifrado guardado en algorithms.json exitosamente' }, { status: 200 });

  } catch (error) {
    console.error("Error al escribir en algorithms.json:", error);
    return NextResponse.json({ error: 'Error interno del servidor al guardar' }, { status: 500 });
  }
}