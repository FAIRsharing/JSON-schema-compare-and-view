(function() {

    var my_app = angular.module('generatorApp', []);

    my_app.controller('viewerCtrl', [ '$http', '$scope',
        function($http, $scope) {

            let viewer = this;

            $scope.make_comparison = function(){
                $http.get($scope.current_comparison).then(function(res){
                    $scope.output = viewer.process_data(res.data);
                    if (res.data.hasOwnProperty("labels")){
                        $scope.labels = res.data["labels"];
                    }
                });
            };

            let inputs_URL = "https://api.github.com/repos/FAIRsharing/JSONschema-compare-and-view/contents/inputs";
            $http.get(inputs_URL).then(function(response) {
                $scope.available_comparison = [];
                for (let file_iterator in response.data) {
                    if (response.data.hasOwnProperty(file_iterator)) {
                        let inputFile = response.data[file_iterator];
                        if (inputFile.hasOwnProperty('path')) {
                            let file_URL = "https://raw.githubusercontent.com/FAIRsharing/JSONschema-compare-and-view/master/" + inputFile['path'];
                            $scope.available_comparison.push(file_URL);
                        }
                    }
                }

                /* get query params */
                let query = location.search.substr(1);

                if (query!==""){
                    let result = {};
                    query.split("&").forEach(function(part) {
                        let item = part.split("=");
                        result[item[0]] = decodeURIComponent(item[1]);
                    });
                    if (result.hasOwnProperty('target')){
                        $scope.current_comparison = result['target'];
                        $scope.make_comparison();
                    }
                    else {
                        $scope.current_comparison = $scope.available_comparison[0];
                        $scope.make_comparison();
                    }
                }
                else {
                    $scope.current_comparison = $scope.available_comparison[0];
                    $scope.make_comparison();
                }
            });

            viewer.process_data = function(data){
                let output = {
                    "header": ["", data.network1.name, data.network2.name],
                    "content": {
                        "overlapped_schemas": {},
                        "isolated_schemas": {}
                    }
                };
                let processed_schemas = {
                    "network1": [],
                    "network2": []
                };
                let ignoredKeys = [
                    "@context",
                    "@id",
                    "@type",
                    "$schema"
                ];

                for (let i in data["overlaps"]){
                    if (data["overlaps"].hasOwnProperty(i)){

                        /* INITIATE NEEDED VAR */
                        let overlap = data["overlaps"][i];
                        let iterator = "overlap" + i.toString();

                        let schema_1_name = overlap[0][0].toLowerCase() + '_schema.json';
                        let schema_2_name = overlap[0][1].toLowerCase() + '_schema.json';
                        let schema_1_link = data['network1']['schemas'][schema_1_name]['id'];
                        let schema_2_link = data['network2']['schemas'][schema_2_name]['id'];
                        let schema_1 = data.network1["schemas"][schema_1_name];
                        let schema_2 = data.network2["schemas"][schema_2_name];
                        let title_1 = data.network1["schemas"][schema_1_name].title;
                        let title_2 = data.network2["schemas"][schema_2_name].title;

                        let name = overlap[0][0];
                        if (overlap[0][0].indexOf("_") > -1){
                            name = "";
                            let schema_local_name_array = overlap[0][0].split("_");
                            for (let sch_name in schema_local_name_array){
                                let schemaRawName = schema_local_name_array[sch_name];
                                name += schemaRawName.charAt(0).toUpperCase() + schemaRawName.slice(1);;
                            }
                        }
                        let local_link = viewer.get_link(name, data.network1['contexts'][schema_1_name]);
                        let base_type = data.network1["contexts"][schema_1_name][name];
                        let local_output = [base_type, title_1, title_2, local_link, schema_1_link, schema_2_link];

                        processed_schemas["network1"].push(schema_1_name);
                        processed_schemas["network2"].push(schema_2_name);
                        output.content.overlapped_schemas[iterator] = {};
                        output.content.overlapped_schemas[iterator]["schemas"] = local_output;
                        output.content.overlapped_schemas[iterator]["fields"] = [];

                        /* Pre-process the overlaps */
                        let overlapped_fields = {};
                        for (let fields in overlap[1]['overlapping fields']){
                            if (overlap[1]['overlapping fields'].hasOwnProperty(fields)){
                                overlapped_fields[overlap[1]['overlapping fields'][fields][0]] = overlap[1]['overlapping fields'][fields][1];
                                overlapped_fields[overlap[1]['overlapping fields'][fields][1]] = overlap[1]['overlapping fields'][fields][0];
                            }

                        }

                        for (let field in schema_1["properties"]){
                            if (schema_1["properties"].hasOwnProperty(field)){

                                if (Object.keys(overlapped_fields).indexOf(field) !==-1){
                                    let link = viewer.get_link(field, data['network1']['contexts'][schema_1_name]);
                                    let local_output = [
                                        viewer.process_name(data.network1['contexts'][schema_1_name][field]),
                                        field,
                                        overlapped_fields[field],
                                        link

                                    ];
                                    output.content.overlapped_schemas[iterator]["fields"].push(local_output)
                                }

                                else if (ignoredKeys.indexOf(field) === -1){
                                    if (data.network1['contexts'][schema_1_name].hasOwnProperty(field)){
                                        let link = viewer.get_link(field, data['network1']['contexts'][schema_1_name]);
                                        let local_output = [
                                            viewer.process_name(data.network1['contexts'][schema_1_name][field]),
                                            field,
                                            false,
                                            link
                                        ];
                                        output.content.overlapped_schemas[iterator]["fields"].push(local_output)
                                    }

                                }
                            }

                        }

                        for (let field in schema_2["properties"]){
                            if (schema_2["properties"].hasOwnProperty(field)){
                                if (ignoredKeys.indexOf(field) === -1 && Object.keys(overlapped_fields).indexOf(field) === -1){
                                    if (data.network2['contexts'][schema_2_name].hasOwnProperty(field)){
                                        let link = viewer.get_link(field, data['network2']['contexts'][schema_2_name]);
                                        let local_output = [
                                            viewer.process_name(data.network2['contexts'][schema_2_name][field]),
                                            false,
                                            field,
                                            link
                                        ];
                                        if (!output.content.overlapped_schemas[iterator]["fields"].includes(local_output)){
                                            output.content.overlapped_schemas[iterator]["fields"].push(local_output)
                                        }

                                    }

                                }
                            }

                        }


                    }
                }

                let it = 0;
                for (let schemaName in data.network1.schemas){
                    if (data.network1.schemas.hasOwnProperty(schemaName) && processed_schemas.network1.indexOf(schemaName) === -1){
                        let iterator = "schema" + it.toString();
                        let schemaValue = data.network1.schemas[schemaName];
                        let attribute = schemaName.replace("_schema.json", "").split("_");
                        for (let it in attribute){
                            attribute[it] = attribute[it].charAt(0).toUpperCase() + attribute[it].slice(1);
                        }
                        attribute = attribute.join().replace(/,/g, "");

                        if (data.network1["contexts"].hasOwnProperty(schemaName)){

                            let schema_base_type = data.network1["contexts"][schemaName][attribute];
                            console.log(attribute);
                            output.content.isolated_schemas[iterator] = {};
                            output.content.isolated_schemas[iterator]["schemas"] = [schema_base_type, schemaValue.title, false];
                            output.content.isolated_schemas[iterator]["fields"] = [];

                            for (let field in schemaValue['properties']){
                                if (schemaValue['properties'].hasOwnProperty(field)
                                    && ignoredKeys.indexOf(field) === -1
                                    && data.network1["contexts"][schemaName].hasOwnProperty(field)){
                                    let field_base_type = viewer.process_name(data.network1["contexts"][schemaName][field]);
                                    if (field_base_type !== false){
                                        let link = viewer.get_link(field, data['network1']['contexts'][schemaName]);
                                        output.content.isolated_schemas[iterator]["fields"].push([
                                            field_base_type,
                                            field,
                                            false,
                                            link
                                        ])
                                    }

                                }
                            }
                        }
                    }
                    it++;
                }
                for (let schemaName in data.network2.schemas){
                    if (data.network2.schemas.hasOwnProperty(schemaName) && processed_schemas.network2.indexOf(schemaName) === -1){
                        let iterator = "schema" + it.toString();
                        let schemaValue = data.network2.schemas[schemaName];
                        let attribute = schemaName.replace("_schema.json", "").split("_");
                        for (let it in attribute){
                            attribute[it] = attribute[it].charAt(0).toUpperCase() + attribute[it].slice(1);
                        }
                        attribute = attribute.join().replace(/,/g, "");

                        if (data.network2["contexts"].hasOwnProperty(schemaName)){
                            let schema_base_type = data.network2["contexts"][schemaName][attribute];
                            output.content.isolated_schemas[iterator] = {};
                            output.content.isolated_schemas[iterator]["schemas"] = [schema_base_type, false, schemaValue.title];
                            output.content.isolated_schemas[iterator]["fields"] = [];

                            for (let field in schemaValue['properties']){
                                if (schemaValue['properties'].hasOwnProperty(field)
                                    && ignoredKeys.indexOf(field) === -1
                                    && data.network2["contexts"][schemaName].hasOwnProperty(field)){
                                    let field_base_type = viewer.process_name(data.network2["contexts"][schemaName][field]);
                                    if (field_base_type !== false){
                                        let link = viewer.get_link(field, data['network2']['contexts'][schemaName]);
                                        output.content.isolated_schemas[iterator]["fields"].push([
                                            field_base_type,
                                            false,
                                            field,
                                            link
                                        ])
                                    }

                                }
                            }
                        }
                    }
                    it++;
                }

                return output;
            };

            viewer.process_name = function(field){
                if (typeof field === 'string') {
                    return field
                }
                else if (field.hasOwnProperty('@id') && field["@id"]!==""){
                    return field["@id"]
                }
                else {
                    return false;
                }
            };

            viewer.get_link = function(field, context){
                let parser = document.createElement('a');
                parser.href = context[field];
                if (parser.protocol === 'https:' || parser.protocol === 'http:'){
                    return context[field]
                }
                else{
                    return context[parser.protocol.replace(":", '')] + context[field].replace(parser.protocol, '');
                }
            }

        }]
    );

    my_app.directive('schemaOverlap', function() {
        return {
            restrict: 'A',
            templateUrl: 'include/schemaOverlap.html',
            scope: {
                schemaOverlap: '=',
                labels: "="
            },
            link: function($scope) {
                $scope.$watch('schemaOverlap', function(schemaOverlap){
                    if(schemaOverlap){
                        $scope.json_source = $scope.schemaOverlap;
                        $scope.term_labels = $scope.labels
                    }
                });
            }
        }
    });

    my_app.directive('isolatedSchema', function() {
        return {
            restrict: 'A',
            templateUrl: 'include/isolated_schema.html',
            scope: {
                isolatedSchema: '=',
                labels: '='
            },
            link: function($scope) {
                $scope.$watch('isolatedSchema', function(isolatedSchema){
                    if(isolatedSchema)
                        $scope.json_source = $scope.isolatedSchema;
                        $scope.term_labels = $scope.labels
                });
            }
        }
    });

    my_app.directive('fieldLabel', function() {
        return {
            restrict: 'A',
            templateUrl: 'include/label.html',
            scope: {
                fieldLabel: '=',
                labels: "="
            },
            link: function($scope) {
                $scope.$watch('fieldLabel', function(fieldLabel){
                    if(fieldLabel){
                        $scope.json_source = $scope.fieldLabel;
                        $scope.term_labels = $scope.labels;
                    }
                });
            }
        }
    });

    my_app.filter('typeOf', function() {
        return function (obj) {
            return typeof obj;
        };
    });

    my_app.filter('labels', function() {
        return function(obj) {
            return obj.replace('.json', '').replace(/_/g, ' ').replace("https://raw.githubusercontent.com/FAIRsharing/JSONschema-compare-and-view/master/inputs/", "");
        }
    })

})();