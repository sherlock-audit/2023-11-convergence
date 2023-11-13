import fs from "fs";
export function render_svg(output: any, name: string, pathRender: string) {
    const raw_slice = output.slice(29);
    const decoded_json = atob(raw_slice);
    const json = JSON.parse(decoded_json);
    const image_base64 = json.image;
    let url = image_base64.replace("data:image/svg+xml;base64,", "");
    var svg = decodeURIComponent(escape(atob(url)));
    fs.writeFile(pathRender + `logo_${name}.svg`, svg, function (err) {
        if (err) throw err;
        // console.log("File is created successfully.");
    });
}
