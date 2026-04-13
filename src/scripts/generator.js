function generateGrid(code) {
    const circleSize = 50; // Tamaño de cada círculo
    const rows = 4;
    const cols = 4;
    const circleColor = '#90713b'; // Color de borde del círculo
    const gradientStart = '#806845'; // Color superior del degradado
    const gradientEnd = '#b19159'; // Color inferior del degradado

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("xmlns", svgNS);
    svg.setAttribute("width", cols * circleSize + 1);
    svg.setAttribute("height", rows * circleSize + 1);
    svg.setAttribute("viewBox", `-1 -1 ${cols * circleSize + 2} ${rows * circleSize + 2}`);

    // Crear definiciones de gradiente
    const defs = document.createElementNS(svgNS, "defs");
    const gradient = document.createElementNS(svgNS, "linearGradient");
    gradient.setAttribute("id", "gradientFill");
    gradient.setAttribute("x1", "0%");
    gradient.setAttribute("y1", "0%");
    gradient.setAttribute("x2", "0%");
    gradient.setAttribute("y2", "100%");

    const stop1 = document.createElementNS(svgNS, "stop");
    stop1.setAttribute("offset", "0%");
    stop1.setAttribute("stop-color", gradientStart);
    stop1.setAttribute("stop-opacity", "0.5");

    const stop2 = document.createElementNS(svgNS, "stop");
    stop2.setAttribute("offset", "100%");
    stop2.setAttribute("stop-color", gradientEnd);
    stop2.setAttribute("stop-opacity", "0.5");

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);
    svg.appendChild(defs);

    // Crear los círculos
    for (let i = 0; i < code.length; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = col * circleSize + circleSize / 2;
        const y = row * circleSize + circleSize / 2;

        const circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute("cx", x);
        circle.setAttribute("cy", y);
        circle.setAttribute("r", circleSize / 2);
        circle.setAttribute("stroke", circleColor);
        circle.setAttribute("stroke-width", 2);
        circle.setAttribute("fill", code[i] === 1 ? "url(#gradientFill)" : "transparent");

        svg.appendChild(circle);
    }

    // Convertir SVG a cadena para exportarlo
    return svg.outerHTML;
}

function gridCodeGenerator(code) {
    const binario = [];
    for (let i = 0; i < 16; i++) {
        const potencia = 2 ** (15 - i);
        if (code >= potencia) {
            binario.push(1);
            code -= potencia;
        } else {
            binario.push(0);
        }
    }
    return binario;
}

// Nueva función para descargar los SVGs en un ZIP
function downloadSVGsAsZip(codes, cromoName, cromoNumber) {
    const zip = new JSZip();
    let i = 1;

    codes.forEach(codeValue => {
        const binaryCode = gridCodeGenerator(codeValue);
        const svgContent = generateGrid(binaryCode);
        const filename = `grid-${i}-${codeValue}.svg`;
        i++;
        // Agregar el archivo SVG al ZIP
        zip.file(filename, svgContent);
    });

    // Generar el ZIP y descargarlo
    zip.generateAsync({ type: "blob" })
        .then(function (content) {
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${cromoNumber}-${cromoName.replace(/[^a-zA-Z0-9-_]/g, '_')}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
}

function getCromoInfo(cromoId) {
    return fetch(`/get-cromo-info/${cromoId}/`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al obtener el nombre o el número del cromo.');
            }
            return response.json();
        })
        .then(data => {
            return { name: data.name, number: data.number }; 
        })
        .catch(error => {
            console.error(error);
            alert('No se pudo obtener el nombre o el número del cromo.');
            return null;
        });
}

// Modificar el evento del botón para usar esta función
document.getElementById('download-btn').addEventListener('click', async () => {
    const downloadButton = document.getElementById('download-btn');
    const cromoId = downloadButton.getAttribute('data-cromo-id');

    const codeInputs = document.querySelectorAll('.unique-code-input');
    const codes = Array.from(codeInputs).map(input => parseInt(input.value, 10));

    if (codes.some(isNaN)) {
        alert("Asegúrate de que todos los códigos sean números válidos.");
        return;
    }

    // Obtener el nombre del cromo del backend
    const cromoInfo = await getCromoInfo(cromoId);
    if (!cromoInfo) return;
    const cromoName = cromoInfo['name'];
    const cromoNumber = cromoInfo['number'];

    // Enviar los datos al servidor y descargar el ZIP
    fetch('/save-unique-codes/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': '{{ csrf_token }}',
        },
        body: JSON.stringify({
            cromo_id: cromoId,
            codes: codes,
        }),
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                console.log('Códigos guardados exitosamente.');
                downloadSVGsAsZip(codes, cromoName, cromoNumber); // Usar el nombre obtenido
            } else {
                console.error('Error al guardar los códigos:', data.message);
                alert('Error al guardar los códigos.');
            }
        })
        .catch(error => {
            console.error('Error en la petición:', error);
            alert('Error de conexión con el servidor.');
        });
});
