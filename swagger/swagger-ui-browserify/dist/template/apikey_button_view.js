var Handlebars = require('handlebars')

module.exports = Handlebars.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    var helper;

  return "<!--div class='auth_button' id='apikey_button'><img class='auth_icon' alt='apply api key' src='images/apikey.jpeg'></div-->\n<div class='auth_container' id='apikey_container'>\n  <div class='key_input_container'>\n    <div class='auth_label'><label for='input_apiKey_entry'>"
    + this.escapeExpression(((helper = (helper = helpers.keyName || (depth0 != null ? depth0.keyName : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === "function" ? helper.call(depth0,{"name":"keyName","hash":{},"data":data}) : helper)))
    + "</label></div>\n    <input placeholder='api_key' class='auth_input' id='input_apiKey_entry' name='apiKey' type='text'/>\n    <div class='auth_submit'><a class='auth_submit_button' id='apply_api_key' href='#' data-sw-translate>apply</a></div>\n  </div>\n</div>\n";
},"useData":true})